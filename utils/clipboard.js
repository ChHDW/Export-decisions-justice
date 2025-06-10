// Gestion du presse-papiers
window.ClipboardManager = {
    
    // Copier du texte dans le presse-papiers
    async copy(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // Fallback pour les navigateurs plus anciens
            return this._fallbackCopy(text);
        }
    },

    // Méthode de fallback pour la copie
    _fallbackCopy(text) {
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.opacity = "0";
            textArea.style.left = "-9999px";
            
            document.body.appendChild(textArea);
            textArea.select();
            textArea.setSelectionRange(0, 99999); // Pour mobile
            
            const successful = document.execCommand("copy");
            document.body.removeChild(textArea);
            
            return successful;
        } catch (err) {
            console.error("Erreur lors de la copie:", err);
            return false;
        }
    },

    // Vérifier si l'API Clipboard est disponible
    isClipboardAPIAvailable() {
        return navigator.clipboard && typeof navigator.clipboard.writeText === "function";
    }
};