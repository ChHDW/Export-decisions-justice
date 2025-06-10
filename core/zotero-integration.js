// Intégration avec Zotero
window.ZoteroIntegration = {
    
    // Vérifier si Zotero Connector est disponible
    isAvailable() {
        return typeof window.Zotero !== "undefined" && 
               window.Zotero && 
               window.Zotero.Connector;
    },

    // Importer directement dans Zotero
    async import(risContent) {
        try {
            if (!this.isAvailable()) {
                throw new Error("Zotero Connector non détecté");
            }

            // Créer un blob avec le contenu RIS
            const blob = window.RISGenerator.createBlob(risContent);
            const url = URL.createObjectURL(blob);
            
            // Utiliser l'API Zotero Connector pour importer
            await window.Zotero.Connector.callMethod("importFromURL", [url, "RIS"]);
            
            // Nettoyer l'URL temporaire
            URL.revokeObjectURL(url);
            
            return { success: true };
        } catch (error) {
            console.error("Erreur import Zotero:", error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    },

    // Afficher une popup de confirmation pour l'import
    async showConfirmDialog() {
        return new Promise((resolve) => {
            const overlay = this._createOverlay();
            const popup = this._createPopup();
            
            overlay.appendChild(popup);
            document.body.appendChild(overlay);

            // Gestionnaires d'événements
            const yesButton = popup.querySelector("#zotero-yes");
            const noButton = popup.querySelector("#zotero-no");
            
            const cleanup = (result) => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
                resolve(result);
            };

            yesButton.addEventListener("click", () => cleanup(true));
            noButton.addEventListener("click", () => cleanup(false));
            
            // Fermer en cliquant sur l'overlay
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) {
                    cleanup(false);
                }
            });

            // Fermer avec Escape
            const handleEscape = (e) => {
                if (e.key === "Escape") {
                    document.removeEventListener("keydown", handleEscape);
                    cleanup(false);
                }
            };
            document.addEventListener("keydown", handleEscape);
        });
    },

    // Créer l'overlay de la popup
    _createOverlay() {
        return window.DOMHelpers.createElement("div", "", {
            position: "fixed",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            zIndex: "10001",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
        });
    },

    // Créer la popup de confirmation
    _createPopup() {
        const popup = window.DOMHelpers.createElement("div", "", {
            background: "white",
            padding: "24px",
            borderRadius: "8px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            maxWidth: "400px",
            textAlign: "center",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        });

        popup.innerHTML = `
            <div style="margin-bottom: 16px;">
                <div style="font-size: 24px; margin-bottom: 8px;">📚</div>
                <h3 style="margin: 0 0 8px 0; color: #333;">Import Zotero</h3>
                <p style="margin: 0; color: #666; font-size: 14px;">
                    Souhaitez-vous importer cette décision dans Zotero ?
                </p>
            </div>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="zotero-yes" style="
                    background: #2d5a27; color: white; border: none; padding: 8px 16px;
                    border-radius: 4px; cursor: pointer; font-size: 14px;
                ">Oui, importer</button>
                <button id="zotero-no" style="
                    background: #666; color: white; border: none; padding: 8px 16px;
                    border-radius: 4px; cursor: pointer; font-size: 14px;
                ">Annuler</button>
            </div>
        `;

        return popup;
    },

    // Workflow complet d'import avec gestion des erreurs
    async importWithConfirmation(risContent) {
        if (!this.isAvailable()) {
            return {
                success: false,
                action: "copy",
                message: "Zotero non détecté. Contenu copié dans le presse-papiers."
            };
        }

        const shouldImport = await this.showConfirmDialog();
        
        if (!shouldImport) {
            return {
                success: false,
                action: "cancelled",
                message: "Import annulé"
            };
        }

        const result = await this.import(risContent);
        
        if (result.success) {
            return {
                success: true,
                action: "imported",
                message: "Décision importée dans Zotero !"
            };
        } else {
            return {
                success: false,
                action: "copy",
                message: "Import Zotero échoué. Contenu copié dans le presse-papiers."
            };
        }
    }
};