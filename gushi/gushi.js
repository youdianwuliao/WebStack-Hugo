const topBtn = document.getElementById('topBtn');
    window.addEventListener('scroll', function() { topBtn.classList.toggle('show', window.scrollY > 400); }, { passive: true });
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() { navigator.serviceWorker.register('../sw.js').catch(function() {}); });
    }
