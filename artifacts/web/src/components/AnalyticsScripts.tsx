import { useEffect } from "react";
import { useLocation } from "wouter";

interface TrackingSettings {
  enabled: boolean;
  yandexMetrikaId: string;
  googleAnalyticsId: string;
  googleTagManagerId: string;
  headCode: string;
  bodyCode: string;
}

const TRACKING_ATTR = "data-site-tracking";

function yandexMetrikaCode(id: string): string {
  if (!id) return "";
  return `
<!-- Yandex.Metrika counter -->
<script type="text/javascript">
  (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  for (var j = 0; j < document.scripts.length; j++) { if (document.scripts[j].src === r) { return; } }
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
  (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
  ym(${id}, "init", { clickmap:true, trackLinks:true, accurateTrackBounce:true, webvisor:true });
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/${id}" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
<!-- /Yandex.Metrika counter -->`;
}

function googleAnalyticsCode(id: string): string {
  if (!id) return "";
  return `
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag("js", new Date());
  gtag("config", "${id}");
</script>
<!-- /Google Analytics -->`;
}

function googleTagManagerHeadCode(id: string): string {
  if (!id) return "";
  return `
<!-- Google Tag Manager -->
<script>
  (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({"gtm.start": new Date().getTime(),event:"gtm.js"});
  var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!="dataLayer"?"&l="+l:"";
  j.async=true;j.src="https://www.googletagmanager.com/gtm.js?id="+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,"script","dataLayer","${id}");
</script>
<!-- /Google Tag Manager -->`;
}

function googleTagManagerBodyCode(id: string): string {
  if (!id) return "";
  return `
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- /Google Tag Manager (noscript) -->`;
}

function appendHtml(target: HTMLElement, html: string): void {
  const template = document.createElement("template");
  template.innerHTML = html;

  template.content.childNodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    if (node.nodeName.toLowerCase() !== "script") {
      const element = node.cloneNode(true) as HTMLElement;
      element.setAttribute(TRACKING_ATTR, "true");
      target.appendChild(element);
      return;
    }

    const source = node as HTMLScriptElement;
    const script = document.createElement("script");
    Array.from(source.attributes).forEach((attr) => script.setAttribute(attr.name, attr.value));
    script.setAttribute(TRACKING_ATTR, "true");
    script.text = source.text;
    target.appendChild(script);
  });
}

function removeExistingContainers(): void {
  document.querySelectorAll(`[${TRACKING_ATTR}="true"]`).forEach((node) => node.remove());
}

export function AnalyticsScripts() {
  const [location] = useLocation();

  useEffect(() => {
    if (location.startsWith("/admin")) {
      removeExistingContainers();
      return;
    }

    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch("/api/analytics/settings", { signal: controller.signal });
        if (!res.ok) return;
        const settings = (await res.json()) as TrackingSettings;
        removeExistingContainers();
        if (!settings.enabled) return;

        appendHtml(
          document.head,
          [
            googleTagManagerHeadCode(settings.googleTagManagerId),
            googleAnalyticsCode(settings.googleAnalyticsId),
            yandexMetrikaCode(settings.yandexMetrikaId),
            settings.headCode,
          ].filter(Boolean).join("\n"),
        );
        appendHtml(document.body, [googleTagManagerBodyCode(settings.googleTagManagerId), settings.bodyCode].filter(Boolean).join("\n"));
      } catch {
        if (!controller.signal.aborted) removeExistingContainers();
      }
    }

    void load();

    return () => {
      controller.abort();
      removeExistingContainers();
    };
  }, [location]);

  return null;
}
