(function () {
    'use strict';

    var LOADER_ID = 'page-loader';
    var STYLE_ID = 'global-page-loader-style';
    var MIN_VISIBLE_MS = 350;
    // Safety net: if `load`/`pageshow` never fires after a showLoader() call
    // (downloads, in-page anchors, AJAX flows, browser kept the old page),
    // force the loader off after this many ms so users are never stuck.
    var SAFETY_HIDE_MS = 6000;
    // Heuristic for "this anchor triggers a download, not a navigation".
    // Matches the path part only; query/hash are tolerated after.
    var DOWNLOAD_EXT_RE = /\.(csv|tsv|pdf|xlsx|xls|zip|7z|rar|docx|doc|pptx|ppt|json|png|jpg|jpeg|gif|svg|webp|mp3|mp4|mov|webm|wav|txt|xml)(\?|#|$)/i;
    var hideTimer = null;
    var safetyTimer = null;
    var shownAt = Date.now();

    function getCurrentScript() {
        return document.currentScript || (function () {
            var scripts = document.getElementsByTagName('script');
            return scripts[scripts.length - 1] || null;
        })();
    }

    function getLoaderImage() {
        var script = getCurrentScript();
        if (script && script.getAttribute('data-loader-img')) {
            return script.getAttribute('data-loader-img');
        }
        if (script && script.src && script.src.indexOf('/assets/js/global-loader.js') !== -1) {
            return script.src.replace('/assets/js/global-loader.js', '/assets/img/aircairo-loader.gif');
        }
        return 'assets/img/aircairo-loader.gif';
    }

    var loaderImage = getLoaderImage();

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '#page-loader,.mi-page-loader{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;background:rgba(255,255,255,.96)!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;z-index:2147483647!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important;transition:opacity .28s ease,visibility .28s ease!important;}',
            '#page-loader.is-hidden,.mi-page-loader.is-hidden{opacity:0!important;visibility:hidden!important;pointer-events:none!important;}',
            '#page-loader.show,.mi-page-loader.show{opacity:1!important;visibility:visible!important;pointer-events:auto!important;}',
            '#page-loader .loader-gif,#page-loader .mi-loader-gif,.mi-page-loader .loader-gif,.mi-page-loader .mi-loader-gif{width:200px!important;height:200px!important;object-fit:contain!important;display:block!important;}',
            '#page-loader .loader-text,#page-loader .mi-loader-text,.mi-page-loader .loader-text,.mi-page-loader .mi-loader-text{color:#462B73!important;font:600 14px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif!important;letter-spacing:3px!important;margin-top:18px!important;text-transform:uppercase!important;}',
            '#page-loader .loader-dots,#page-loader .mi-loader-dots,.mi-page-loader .loader-dots,.mi-page-loader .mi-loader-dots{display:flex!important;gap:7px!important;margin-top:16px!important;align-items:center!important;justify-content:center!important;}',
            '#page-loader .loader-dots span,#page-loader .mi-loader-dots span,.mi-page-loader .loader-dots span,.mi-page-loader .mi-loader-dots span{width:8px!important;height:8px!important;background:#F7941D!important;border-radius:50%!important;display:block!important;animation:mi-loader-bounce 1.25s ease-in-out infinite!important;}',
            '#page-loader .loader-dots span:nth-child(2),#page-loader .mi-loader-dots span:nth-child(2),.mi-page-loader .loader-dots span:nth-child(2),.mi-page-loader .mi-loader-dots span:nth-child(2){animation-delay:.18s!important;}',
            '#page-loader .loader-dots span:nth-child(3),#page-loader .mi-loader-dots span:nth-child(3),.mi-page-loader .loader-dots span:nth-child(3),.mi-page-loader .mi-loader-dots span:nth-child(3){animation-delay:.36s!important;}',
            '@keyframes mi-loader-bounce{0%,80%,100%{transform:scale(.62);opacity:.45;}40%{transform:scale(1.15);opacity:1;}}',
            '@media(max-width:640px){#page-loader .loader-gif,#page-loader .mi-loader-gif,.mi-page-loader .loader-gif,.mi-page-loader .mi-loader-gif{width:160px!important;height:160px!important;}}'
        ].join('\n');
        (document.head || document.documentElement).appendChild(style);
    }

    function createLoader() {
        var loader = document.createElement('div');
        loader.id = LOADER_ID;
        loader.className = 'mi-page-loader show';
        loader.setAttribute('data-mi-page-loader', 'true');
        loader.setAttribute('role', 'status');
        loader.setAttribute('aria-live', 'polite');
        loader.setAttribute('aria-label', 'Loading');
        loader.innerHTML = [
            '<img class="loader-gif mi-loader-gif" src="' + loaderImage + '" alt="Loading">',
            '<div class="loader-text mi-loader-text">LOADING</div>',
            '<div class="loader-dots mi-loader-dots"><span></span><span></span><span></span></div>'
        ].join('');
        return loader;
    }

    function ensureLoader() {
        var loader = document.getElementById(LOADER_ID);
        if (!loader) {
            loader = createLoader();
            if (document.body) {
                document.body.insertBefore(loader, document.body.firstChild);
            } else {
                document.documentElement.appendChild(loader);
            }
        }
        if (loader) {
            loader.classList.add('mi-page-loader');
            loader.setAttribute('data-mi-page-loader', 'true');
            if (!loader.querySelector('.loader-gif,.mi-loader-gif')) {
                loader.appendChild(createLoader().firstChild);
            }
        }
        return loader;
    }

    function armSafetyTimer() {
        if (safetyTimer) {
            clearTimeout(safetyTimer);
        }
        safetyTimer = setTimeout(function () {
            safetyTimer = null;
            hideLoader();
        }, SAFETY_HIDE_MS);
    }

    function clearSafetyTimer() {
        if (safetyTimer) {
            clearTimeout(safetyTimer);
            safetyTimer = null;
        }
    }

    function showLoader() {
        injectStyle();
        var loader = ensureLoader();
        if (!loader) {
            return;
        }
        shownAt = Date.now();
        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
        loader.classList.remove('is-hidden');
        loader.classList.add('show');
        loader.setAttribute('aria-hidden', 'false');
        armSafetyTimer();
    }

    function hideLoader() {
        var loader = ensureLoader();
        if (!loader) {
            return;
        }

        clearSafetyTimer();
        var elapsed = Date.now() - shownAt;
        var delay = Math.max(0, MIN_VISIBLE_MS - elapsed);
        if (hideTimer) {
            clearTimeout(hideTimer);
        }
        hideTimer = setTimeout(function () {
            loader.classList.add('is-hidden');
            loader.classList.remove('show');
            loader.setAttribute('aria-hidden', 'true');
            hideTimer = null;
        }, delay);
    }

    function shouldIgnoreUrl(rawHref, anchor) {
        if (!rawHref) {
            return true;
        }
        var trimmed = rawHref.trim();
        if (!trimmed || trimmed === '#' || trimmed.charAt(0) === '#' ||
                trimmed.indexOf('javascript:') === 0 ||
                trimmed.indexOf('mailto:') === 0 || trimmed.indexOf('tel:') === 0 ||
                trimmed.indexOf('blob:') === 0 || trimmed.indexOf('data:') === 0) {
            return true;
        }
        if (anchor && (anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self'))) {
            return true;
        }
        try {
            var nextUrl = new URL(trimmed, window.location.href);
            var currentUrl = new URL(window.location.href);
            // Download-by-extension heuristic: file downloads do NOT cause a
            // page reload, so showing a loader for them would leave it stuck.
            if (DOWNLOAD_EXT_RE.test(nextUrl.pathname)) {
                return true;
            }
            nextUrl.hash = '';
            currentUrl.hash = '';
            if (nextUrl.href === currentUrl.href) {
                // Same-page navigation (hash change or no change at all).
                return true;
            }
        } catch (e) {
            return false;
        }
        return false;
    }

    function clickHasModifier(event) {
        return event.defaultPrevented || event.button !== 0 ||
            event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    }

    function bindNavigationHooks() {
        document.addEventListener('click', function (event) {
            // Programmatic clicks (e.g. temp <a> for file downloads) MUST NOT
            // trigger the loader — they don't unload the page so the loader
            // would stay forever. Real user clicks have isTrusted === true.
            if (event.isTrusted === false) {
                return;
            }
            if (clickHasModifier(event)) {
                return;
            }

            var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
            if (anchor && !shouldIgnoreUrl(anchor.getAttribute('href'), anchor)) {
                showLoader();
                return;
            }

            var button = event.target && event.target.closest ? event.target.closest('button,[role="button"],input[type="button"],input[type="submit"]') : null;
            if (!button) {
                return;
            }
            var onclick = button.getAttribute('onclick') || '';
            if (/\b(location|window\.location|document\.location)\b/.test(onclick)) {
                showLoader();
            }
            // NOTE: submit-type buttons used to auto-trigger showLoader here,
            // and a global submit-event hook did the same. Both were removed
            // because dashboards almost always submit via AJAX (no reload),
            // leaving the loader stuck. Real cross-page submits will still
            // hit `beforeunload` and show the loader correctly.
        }, true);

        window.addEventListener('beforeunload', showLoader);
        window.addEventListener('pagehide', showLoader);
        window.addEventListener('load', hideLoader);
        window.addEventListener('pageshow', hideLoader);
        // SPA-style navigation (hash change, history pushState) never fires
        // `load` or `pageshow`, so if a stale showLoader() was triggered we
        // must hide it here. Otherwise tab clicks on the WhatsApp dashboard
        // leave the loader visible forever.
        window.addEventListener('hashchange', hideLoader);
        window.addEventListener('popstate', hideLoader);
    }

    injectStyle();
    if (document.body) {
        showLoader();
    } else {
        document.addEventListener('DOMContentLoaded', showLoader, { once: true });
    }
    bindNavigationHooks();

    window.showGlobalLoader = showLoader;
    window.hideGlobalLoader = hideLoader;
})();
