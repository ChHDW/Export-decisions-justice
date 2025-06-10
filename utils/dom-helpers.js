// Utilitaires pour la manipulation du DOM
window.DOMHelpers = {
    
    // Attendre que la page soit complètement chargée
    waitForPage() {
        return new Promise((resolve) => {
            if (document.readyState === "complete") {
                resolve();
            } else {
                window.addEventListener("load", resolve);
            }
        });
    },

    // Attendre qu'un élément soit disponible
    waitForElement(selector, timeout = 10000) {
        return new Promise((resolve) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver(() => {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Timeout après le délai spécifié
            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
    },

    // Nettoyer le texte extrait
    cleanText(text) {
        if (!text) return "";
        
        // Normaliser les espaces et sauts de ligne
        text = text.replace(/\n\s*\n\s*\n/g, "\n\n");
        text = text.replace(/[ \t]+/g, " ");
        text = text.trim();
        
        return text;
    },

    // Extraire le texte d'un élément en nettoyant le HTML
    extractTextFromElement(element) {
        if (!element) return null;
        
        const clone = element.cloneNode(true);
        
        // Supprimer les scripts et styles
        clone.querySelectorAll("script, style").forEach(el => el.remove());
        
        let text = clone.textContent || clone.innerText || "";
        return this.cleanText(text);
    },

    // Créer un élément avec du style inline
    createElement(tag, className, styles = {}) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        
        const styleString = Object.entries(styles)
            .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
            .join("; ");
        
        if (styleString) element.style.cssText = styleString;
        
        return element;
    }
};