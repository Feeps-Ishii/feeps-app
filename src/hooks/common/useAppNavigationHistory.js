import { useEffect, useRef, useState } from "react";
import {
  TRAINING_TARGET_CHANGE_EVENT,
  clearTrainingTargetContext,
  getTrainingTargetContext,
  setTrainingTargetContext,
} from "../../utils/common/courseContext.js";
import {
  PRODUCT_DETAIL_HISTORY_EVENT,
  clearNavigationHistoryEntry,
  getNavigationEpoch,
  readNavigationHistoryEntry,
  rotateNavigationEpoch,
  writeNavigationHistoryEntry,
} from "../../utils/common/navigationHistory.js";

function storageGet(key, fallback = "") {
  try { return window.localStorage.getItem(key) || fallback; }
  catch { return fallback; }
}

function safeText(value, maxLength = 256) {
  const text = String(value ?? "").trim();
  if (!text || text.length > maxLength || /[\u0000-\u001f\u007f]/.test(text)) return "";
  return text;
}

function safeDate(value) {
  const text = String(value || "");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return "";
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? text : "";
}

function routeKey(route) {
  return JSON.stringify({
    product: route.product,
    view: route.view,
    subView: route.subView,
    karteId: route.karteId || "",
    trainingTarget: route.trainingTarget || null,
    productDetail: route.productDetail || null,
  });
}

export default function useAppNavigationHistory({
  loggedIn,
  profileChecked,
  role,
  product,
  view,
  subView,
  karte,
  navigationVersion,
  setNavigationVersion,
  mainScrollRef,
  setScrolled,
  setProduct,
  setView,
  setSubView,
  setKarte,
  setDrawerOpen,
  setPaletteOpen,
  setNotifOpen,
  setSidebarUserOpen,
  setDemoOpen,
  normalizeRoute,
}) {
  const epochRef = useRef(getNavigationEpoch());
  const readyRef = useRef(false);
  const restoreKeyRef = useRef("");
  const lastKeyRef = useRef("");
  const recordVersionRef = useRef(0);
  const scrollSaveRef = useRef(null);
  const scrollRestoreTimerRef = useRef(null);
  const scrollRestoreUntilRef = useRef(0);
  const pendingScrollRef = useRef(null);
  const suppressTargetEventRef = useRef(false);
  const trainingTargetRef = useRef(getTrainingTargetContext("", { consume: false }));
  const productDetailRef = useRef(null);
  const [, setProductDetailRevision] = useState(0);
  const stateRef = useRef(null);
  stateRef.current = { loggedIn, profileChecked, role, product, view, subView, karte };

  function currentScroll() {
    return Math.max(0, Number(mainScrollRef.current?.scrollTop || 0), Number(window.scrollY || 0));
  }

  function currentRoute(overrides = {}) {
    const current = stateRef.current;
    return normalizeRoute({
      product: current.product,
      view: current.view,
      subView: current.subView,
      karteId: current.karte?.id || current.karte?.userId || "",
      trainingTarget: trainingTargetRef.current,
      productDetail: productDetailRef.current,
      ...overrides,
    }, current.role);
  }

  function buildEntry(route, scrollTop = 0) {
    return {
      version: 1,
      epoch: epochRef.current,
      authUserId: storageGet("feeps.authUserId"),
      role: stateRef.current.role,
      ...route,
      scrollTop: Math.max(0, Math.min(Number(scrollTop) || 0, 10_000_000)),
    };
  }

  function isCurrentEntry(entry) {
    const authUserId = storageGet("feeps.authUserId");
    return !!entry
      && !!authUserId
      && entry.epoch === epochRef.current
      && entry.authUserId === authUserId
      && entry.role === stateRef.current.role;
  }

  function replaceCurrentEntry({ scrollTop = currentScroll() } = {}) {
    const current = stateRef.current;
    if (!readyRef.current || !current.loggedIn || !current.profileChecked) return;
    const route = currentRoute();
    writeNavigationHistoryEntry(buildEntry(route, scrollTop));
    lastKeyRef.current = routeKey(route);
  }

  function scheduleScrollSave() {
    if (!readyRef.current || Date.now() < scrollRestoreUntilRef.current) return;
    if (scrollSaveRef.current) window.clearTimeout(scrollSaveRef.current);
    scrollSaveRef.current = window.setTimeout(() => {
      scrollSaveRef.current = null;
      replaceCurrentEntry();
    }, 100);
  }

  function scrollToRouteTop() {
    if (scrollSaveRef.current) window.clearTimeout(scrollSaveRef.current);
    scrollSaveRef.current = null;
    scrollRestoreUntilRef.current = Date.now() + 300;
    mainScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    window.scrollTo({ top: 0, behavior: "auto" });
    setScrolled(false);
  }

  function resetSession() {
    readyRef.current = false;
    recordVersionRef.current += 1;
    restoreKeyRef.current = "";
    lastKeyRef.current = "";
    pendingScrollRef.current = null;
    scrollRestoreUntilRef.current = 0;
    trainingTargetRef.current = null;
    productDetailRef.current = null;
    if (scrollSaveRef.current) window.clearTimeout(scrollSaveRef.current);
    if (scrollRestoreTimerRef.current) window.clearTimeout(scrollRestoreTimerRef.current);
    scrollSaveRef.current = null;
    scrollRestoreTimerRef.current = null;
    epochRef.current = rotateNavigationEpoch();
    clearNavigationHistoryEntry();
  }

  function setTrainingTarget(target) {
    const normalized = target && typeof target === "object" ? {
      view: safeText(target.view, 64),
      courseId: safeText(target.courseId),
      testId: safeText(target.testId),
      date: safeDate(target.date),
      mode: ["taking", "result"].includes(target.mode) ? target.mode : "",
    } : null;
    const hasTarget = normalized && normalized.view && (normalized.courseId || normalized.testId || normalized.date);
    trainingTargetRef.current = hasTarget ? normalized : null;
    suppressTargetEventRef.current = true;
    try {
      if (hasTarget) setTrainingTargetContext(normalized);
      else clearTrainingTargetContext();
    } finally {
      suppressTargetEventRef.current = false;
    }
  }

  function applyEntry(entry) {
    const route = normalizeRoute(entry, stateRef.current.role);
    restoreKeyRef.current = routeKey(route);
    pendingScrollRef.current = Math.max(0, Math.min(Number(entry.scrollTop) || 0, 10_000_000));
    setTrainingTarget(route.trainingTarget);
    productDetailRef.current = route.productDetail;
    setProduct(route.product);
    setView(route.view);
    setSubView(route.subView);
    setKarte(route.karteId ? { id: route.karteId, userId: route.karteId } : null);
    setNavigationVersion(version => version + 1);
    setDrawerOpen(false);
    setPaletteOpen(false);
    setNotifOpen(false);
    setSidebarUserOpen(false);
    setDemoOpen(false);
  }

  function navigateKarte(nextKarte) {
    replaceCurrentEntry();
    if (nextKarte) {
      setKarte(nextKarte);
      setDrawerOpen(false);
      return;
    }
    const entry = readNavigationHistoryEntry();
    if (isCurrentEntry(entry) && entry.karteId) window.history.back();
    else setKarte(null);
  }

  useEffect(() => {
    const onWindowScroll = () => {
      setScrolled(window.scrollY > 0);
      scheduleScrollSave();
    };
    onWindowScroll();
    window.addEventListener("scroll", onWindowScroll, { passive: true });
    return () => window.removeEventListener("scroll", onWindowScroll);
  }, []);

  useEffect(() => {
    const savedScroll = pendingScrollRef.current;
    pendingScrollRef.current = null;
    const top = Number.isFinite(savedScroll) ? savedScroll : 0;
    scrollRestoreUntilRef.current = top > 0 ? Date.now() + 10_000 : 0;
    const restore = () => {
      mainScrollRef.current?.scrollTo({ top, behavior: "auto" });
      window.scrollTo({ top, behavior: "auto" });
      const restoredTop = Math.max(Number(mainScrollRef.current?.scrollTop || 0), Number(window.scrollY || 0));
      setScrolled(restoredTop > 0);
      if (top > 0 && restoredTop + 4 < top && Date.now() < scrollRestoreUntilRef.current) {
        scrollRestoreTimerRef.current = window.setTimeout(restore, 120);
      } else {
        scrollRestoreTimerRef.current = null;
        scrollRestoreUntilRef.current = 0;
      }
    };
    const frame = window.requestAnimationFrame(restore);
    return () => {
      window.cancelAnimationFrame(frame);
      if (scrollRestoreTimerRef.current) window.clearTimeout(scrollRestoreTimerRef.current);
      scrollRestoreTimerRef.current = null;
    };
  }, [product, view, subView, karte, navigationVersion]);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useEffect(() => {
    const onTargetChange = event => {
      const raw = event?.detail?.target || null;
      const normalized = raw ? { view: safeText(raw.view, 64), courseId: safeText(raw.courseId), testId: safeText(raw.testId), date: safeDate(raw.date), mode: ["taking", "result"].includes(raw.mode) ? raw.mode : "" } : null;
      const nextTarget = normalized && (normalized.courseId || normalized.testId || normalized.date) ? normalized : null;
      const previousTarget = trainingTargetRef.current;
      if (suppressTargetEventRef.current) return;
      if (!readyRef.current) { trainingTargetRef.current = nextTarget; return; }
      const current = stateRef.current;
      if (current.product !== "training") return;
      if (nextTarget && nextTarget.view !== current.view) { trainingTargetRef.current = nextTarget; return; }
      if (event?.detail?.historyAction === "push" && nextTarget) {
        trainingTargetRef.current = previousTarget;
        replaceCurrentEntry();
        trainingTargetRef.current = nextTarget;
        const route = currentRoute();
        const key = routeKey(route);
        if (key !== lastKeyRef.current) {
          writeNavigationHistoryEntry(buildEntry(route, 0), { push: true });
          lastKeyRef.current = key;
          scrollToRouteTop();
        }
        return;
      }
      const previousKey = routeKey(currentRoute());
      trainingTargetRef.current = nextTarget;
      replaceCurrentEntry();
      if (routeKey(currentRoute()) !== previousKey) scrollToRouteTop();
    };
    window.addEventListener(TRAINING_TARGET_CHANGE_EVENT, onTargetChange);
    return () => window.removeEventListener(TRAINING_TARGET_CHANGE_EVENT, onTargetChange);
  }, []);

  useEffect(() => {
    const onProductDetailChange = event => {
      const current = stateRef.current;
      const nextDetail = normalizeRoute({ product: current.product, view: current.view, subView: current.subView, productDetail: event?.detail?.target || null }, current.role).productDetail;
      const previousDetail = productDetailRef.current;
      if (!readyRef.current) {
        productDetailRef.current = nextDetail;
        setProductDetailRevision(version => version + 1);
        return;
      }
      if (!nextDetail || event?.detail?.historyAction === "replace") {
        const previousKey = routeKey(currentRoute());
        productDetailRef.current = nextDetail;
        replaceCurrentEntry();
        if (routeKey(currentRoute()) !== previousKey) scrollToRouteTop();
        setProductDetailRevision(version => version + 1);
        return;
      }
      productDetailRef.current = previousDetail;
      replaceCurrentEntry();
      productDetailRef.current = nextDetail;
      const route = currentRoute();
      const key = routeKey(route);
      if (key !== lastKeyRef.current) {
        writeNavigationHistoryEntry(buildEntry(route, 0), { push: true });
        lastKeyRef.current = key;
        scrollToRouteTop();
      }
      setProductDetailRevision(version => version + 1);
    };
    window.addEventListener(PRODUCT_DETAIL_HISTORY_EVENT, onProductDetailChange);
    return () => window.removeEventListener(PRODUCT_DETAIL_HISTORY_EVENT, onProductDetailChange);
  }, []);

  useEffect(() => {
    const save = () => replaceCurrentEntry();
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("pagehide", save);
      if (scrollSaveRef.current) window.clearTimeout(scrollSaveRef.current);
      if (scrollRestoreTimerRef.current) window.clearTimeout(scrollRestoreTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!loggedIn || !profileChecked || readyRef.current) return;
    const entry = readNavigationHistoryEntry();
    readyRef.current = true;
    if (isCurrentEntry(entry)) applyEntry(entry);
    else {
      const route = currentRoute();
      writeNavigationHistoryEntry(buildEntry(route, 0));
      lastKeyRef.current = routeKey(route);
    }
  }, [loggedIn, profileChecked, role]);

  useEffect(() => {
    if (!loggedIn || !profileChecked || !readyRef.current) return;
    const version = ++recordVersionRef.current;
    queueMicrotask(() => {
      if (version !== recordVersionRef.current || !readyRef.current) return;
      const route = currentRoute();
      const key = routeKey(route);
      if (restoreKeyRef.current) {
        const restoredKey = restoreKeyRef.current;
        restoreKeyRef.current = "";
        if (key === restoredKey) { lastKeyRef.current = key; return; }
      }
      if (key === lastKeyRef.current) return;
      writeNavigationHistoryEntry(buildEntry(route, 0), { push: true });
      lastKeyRef.current = key;
    });
  }, [loggedIn, profileChecked, role, product, view, subView, karte, navigationVersion]);

  useEffect(() => {
    const onPopState = event => {
      const current = stateRef.current;
      if (!current.loggedIn || !current.profileChecked || !readyRef.current) return;
      const entry = readNavigationHistoryEntry(event.state);
      if (isCurrentEntry(entry)) applyEntry(entry);
      else {
        const safeRoute = normalizeRoute({ product: "home", view: "home", subView: "home" }, current.role);
        const safeEntry = buildEntry(safeRoute, 0);
        writeNavigationHistoryEntry(safeEntry);
        applyEntry(safeEntry);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function clearProductDetail() { productDetailRef.current = null; }

  return {
    clearProductDetail,
    navigateKarte,
    productDetail: productDetailRef.current,
    replaceCurrentEntry,
    resetSession,
    scheduleScrollSave,
    setTrainingTarget,
  };
}
