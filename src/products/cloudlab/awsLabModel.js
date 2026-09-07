// AWS実習（モック）の中身。正典: docs/specs/aws-lab-spec.md §6
//
// **本物のAWSは使わない。** ここで動くのは全部この関数たちで、費用も事故もアカウントも要らない。
// 目的は「つながらない理由を名指しする」こと。本物だと「なぜか繋がらない」で止まってしまい、
// 初学者はそこから先へ進めない。
//
// 通信の道筋は**本物と同じ順番**で見る。順番を変えると、直す場所も変わってしまう。
//   インターネット → IGW → サブネットのルート → 宛先(パブリックIP) → SG → アプリ
//
// **起動時に決まるものと、あとから変えられるものを分けている。** ここが本物の勘所で、
// ユーザーデータは最初の1回しか動かない。あとから書き直しても何も起きない。
//   起動時に固定: サブネット・パブリックIP・ユーザーデータ
//   あとから変更可: IGW・ルート・セキュリティグループ

export const HTTP = 80;
export const SSH = 22;

export function initialLabState(initial = {}) {
  return {
    igw: !!initial.igw,
    routeA: initial.routeA === "igw" ? "igw" : "local",
    routeB: initial.routeB === "igw" ? "igw" : "local",
    // 起動前の設定（instance が無い間だけ効く）
    subnet: initial.subnet === "b" ? "b" : "a",
    publicIp: !!initial.publicIp,
    userData: typeof initial.userData === "string" ? initial.userData : "",
    // あとから変えられる
    sg: Array.isArray(initial.sg) ? initial.sg.filter(p => p === HTTP || p === SSH) : [],
    // 起動しているEC2。起動時の設定を**写し取る**
    instance: null,
  };
}

// ── ユーザーデータを「起動時に1回だけ」動かす ──
// 本物のEC2と同じ引っかかりどころを再現する。どれも実際によく起きる。
export function bootUserData(userData) {
  const src = String(userData || "");
  const firstLine = (src.split("\n").find(l => l.trim() !== "") || "").trim();

  if (!src.trim()) {
    return {
      running: false, indexWritten: false,
      why: "ユーザーデータが空です。起動しただけのEC2には、何のアプリも入っていません。",
      fix: "#!/bin/bash から始まるスクリプトを書いて、Webサーバーを入れて起動します。",
    };
  }
  // **1行目が #! でないとスクリプトとして実行されない。** エラーも出ずに黙って何も起きない
  if (!/^#!\s*\/.*sh/.test(firstLine)) {
    return {
      running: false, indexWritten: false,
      why: `1行目が「${firstLine.slice(0, 40)}」です。#!/bin/bash で始まっていないと、ユーザーデータはスクリプトとして実行されません。`,
      fix: "1行目を #!/bin/bash にしてください。エラーは出ないまま、何も動かない状態になります。",
    };
  }
  const installed = /(?:yum|dnf|apt-get|apt)\s+(?:-y\s+)?install\s+[^\n]*\b(?:httpd|apache2|nginx)\b/.test(src);
  if (!installed) {
    return {
      running: false, indexWritten: false,
      why: "Webサーバーを入れる行がありません。80番を開けても、受け止めるアプリがいません。",
      fix: "dnf install -y httpd のように、Webサーバーを入れる行を足します。",
    };
  }
  // enable だけでは「次に起動したとき」しか効かない。--now か start が要る
  const started = /systemctl\s+(?:start|restart|enable\s+--now)\s+\S*(?:httpd|apache2|nginx)/.test(src)
    || /service\s+\S*(?:httpd|apache2|nginx)\s+start/.test(src);
  if (!started) {
    const enableOnly = /systemctl\s+enable\s+\S*(?:httpd|apache2|nginx)/.test(src);
    return {
      running: false, indexWritten: false,
      why: enableOnly
        ? "systemctl enable は「次に起動したときに動かす」設定で、いま動かす指示ではありません。"
        : "Webサーバーを入れただけで、動かす行がありません。**入れる＝動く ではありません。**",
      fix: "systemctl enable --now httpd を足します（いま動かす＋次回以降も動かす）。",
    };
  }
  const indexWritten = /(?:>|>>|tee)\s*\/var\/www\/html\/index\.html/.test(src);
  return { running: true, indexWritten, why: "", fix: "" };
}

// EC2を起動する。**この瞬間の設定が焼き付く**
export function launchInstance(state) {
  return {
    ...state,
    instance: {
      subnet: state.subnet,
      publicIp: state.publicIp,
      userDataAtBoot: state.userData,
      boot: bootUserData(state.userData),
    },
  };
}

export function terminateInstance(state) {
  return { ...state, instance: null };
}

// ── 外から届くかを、本物と同じ順番で見る ──
// **ここが教材の芯。どこで止まったかを名指しする。**
export function traceHttp(state) {
  const steps = [];
  const stop = (why, fix) => ({ ok: false, why, fix, steps });
  const inst = state.instance;

  if (!inst) return stop("EC2がまだ起動していません。", "設定を決めてから「EC2を起動する」を押してください。");
  steps.push("インターネット → VPCの入口をさがす");

  if (!state.igw) {
    return stop(
      "VPCにインターネットゲートウェイが付いていません。VPCは既定では外とつながっていません。",
      "インターネットゲートウェイを付けます。",
    );
  }
  steps.push("インターネットゲートウェイ … あり");

  const route = inst.subnet === "a" ? state.routeA : state.routeB;
  if (route !== "igw") {
    return stop(
      `EC2はサブネット${inst.subnet.toUpperCase()}にあります。このサブネットのルートは local だけなので、外から入る道がありません。`,
      "そのサブネットのルートを「0.0.0.0/0 → IGW」にします。IGWを付けただけでは通りません。",
    );
  }
  steps.push(`サブネット${inst.subnet.toUpperCase()}のルート … 0.0.0.0/0 → IGW`);

  if (!inst.publicIp) {
    return stop(
      "EC2にパブリックIPがありません。外から呼ぶ宛先そのものがありません。",
      "パブリックIPを「付ける」にして起動し直します。**パブリックIPは起動時に決まります。**",
    );
  }
  steps.push("宛先（パブリックIP） … あり");

  if (!state.sg.includes(HTTP)) {
    return stop(
      state.sg.includes(SSH)
        ? "セキュリティグループがSSH（22）しか受け入れていません。HTTPは閉じています。"
        : "セキュリティグループが何も受け入れていません。届いた通信はここで捨てられます。",
      "80番（HTTP）を開けます。",
    );
  }
  steps.push("セキュリティグループ … HTTP(80) を許可");

  // ここから先はネットワークではなくEC2の中の話。**分けて見せるのが要点**
  if (!inst.boot.running) {
    return stop(
      `ここまでは通りました。EC2まで届いていますが、80番で待っているアプリがいません。${inst.boot.why}`,
      inst.boot.fix + "（ユーザーデータは**最初の起動時にだけ**動くので、書き直したら起動し直します）",
    );
  }
  steps.push("EC2に到達 … Webサーバーが80番で待っている");

  if (!inst.boot.indexWritten) {
    return stop(
      "Webサーバーは動いていますが、見せるページを置いていません。Apacheの既定の画面が返ります。",
      "ユーザーデータで /var/www/html/index.html を書き出してから起動し直します。",
    );
  }
  steps.push("index.html … あり");
  return { ok: true, why: "", fix: "", steps };
}

// 画面に出す確認項目。**通ったところまでを緑にする**ので、進んでいる実感が出る
export function labChecks(state) {
  const r = traceHttp(state);
  const inst = state.instance;
  // **起動前は「これから起動する設定」で見る。** 正しく設定したのに灰色のままだと、
  // 直したことが伝わらない。起動後は焼き付いた側（instance）で見る
  const subnet = inst ? inst.subnet : state.subnet;
  const route = subnet === "a" ? state.routeA : state.routeB;
  const publicIp = inst ? inst.publicIp : state.publicIp;
  const boot = inst ? inst.boot : bootUserData(state.userData);
  const list = [
    { label: "EC2が起動している", ok: !!inst },
    { label: "インターネットゲートウェイが付いている", ok: !!state.igw },
    { label: "サブネットのルートがIGWを向いている", ok: route === "igw" },
    { label: "パブリックIPが付いている", ok: !!publicIp },
    { label: "セキュリティグループが80番を開けている", ok: state.sg.includes(HTTP) },
    { label: "ユーザーデータでWebサーバーが動いている", ok: !!boot.running },
    { label: "index.html を置いている", ok: !!boot.indexWritten },
  ];
  return { checks: list, trace: r };
}
