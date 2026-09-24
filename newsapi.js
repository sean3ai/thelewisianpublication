// do not touch or add or update this file
(function () {
  "use strict";
  
  const container = document.getElementById("news-feed");
  const statusEl = document.getElementById("news-status");
  
  if (!container) return;
  
  /* ---- CONFIGURATION ---- */
  const API_KEY = "49d83ee18faf4e70b5ea7af76995b455";
  const QUERY = "Philippines";
  const MAX_ARTICLES = 5;
  const SORT_BY = "publishedAt";
  /* ------------------------------------------------- */
  
  
  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  
  function timeAgo(dateString) {
    const diff = (Date.now() - new Date(dateString).getTime()) / 1000;
    if (diff < 3600) return Math.round(diff / 60) + "m ago";
    if (diff < 86400) return Math.round(diff / 3600) + "h ago";
    return Math.round(diff / 86400) + "d ago";
  }
  
  function render(articles) {
    container.innerHTML = "";
    
    if (!articles.length) {
      container.appendChild(el("p", "empty", "No headlines available right now."));
      return;
    }
    
    articles.forEach(function (a) {
      const card = el("article", "news-card");
      
      if (a.urlToImage) {
        const img = el("img", "news-thumb");
        img.src = a.urlToImage;
        img.alt = "";
        img.loading = "lazy";
        img.onerror = function () { img.remove(); };
        card.appendChild(img);
      }
      
      const body = el("div", "news-body");
      body.appendChild(el("p", "news-source",
        (a.source && a.source.name) || "Unknown source"));
        
        const title = el("h4", "news-title");
        const link = el("a", null, a.title || "Untitled");
        link.href = a.url || "#";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        title.appendChild(link);
        body.appendChild(title);
        
        if (a.description) {
          body.appendChild(el("p", "news-desc", a.description));
        }
        
        const meta = el("p", "news-meta");
        meta.appendChild(el("span", null, timeAgo(a.publishedAt)));
        const readLink = el("a", "news-read", "Read →");
        readLink.href = a.url || "#";
        readLink.target = "_blank";
        readLink.rel = "noopener noreferrer";
        meta.appendChild(readLink);
        body.appendChild(meta);
        
        card.appendChild(body);
        container.appendChild(card);
      });
    }
    
    function load() {
      if (!API_KEY || API_KEY === "YOUR_NEWSAPI_KEY_HERE") {
        statusEl.textContent = "Sample headlines";
        render(SAMPLE);
        return;
      }
      
      const url = "https://newsapi.org/v2/everything" +
      "?q=" + encodeURIComponent(QUERY) +
      "&language=en" +
      "&sortBy=" + SORT_BY +
      "&pageSize=" + MAX_ARTICLES +
      "&apiKey=" + encodeURIComponent(API_KEY);
      
    fetch(url)
    .then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          throw new Error(data.message || ("HTTP " + res.status));
        }
        return data;
      });
    })
    .then(function (data) {
      const articles = (data.articles || []).filter(function (a) {
        return a.title && a.title !== "[Removed]";
      });
      statusEl.textContent = articles.length
      ? articles.length + (articles.length === 1 ? " headline" : " headlines")
      : "No headlines";
      render(articles);
    })
    .catch(function (err) {
      console.error("NewsAPI request failed:", err);
      statusEl.textContent = "Sample headlines";
      render(SAMPLE);
    });
  }
  
  document.addEventListener("DOMContentLoaded", load);
})();