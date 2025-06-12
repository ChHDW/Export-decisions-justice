// Gestion des boutons de l'interface utilisateur
window.ButtonManager = {
    
    // Configuration des boutons
    BUTTONS: {
        COPY_DECISION: {
            id: "copy-decision",
            className: "options-item type-copy-decision",
            icon: "📄",
            text: "Copier l'arrêt",
            title: "Copier le texte de l'arrêt",
            style: { background: "#4a5e81", color: "white", border: "1px solid #3a4d6a" }
        },
        COPY_ANALYSIS: {
            id: "copy-analysis", 
            className: "options-item type-copy-analysis",
            icon: "📊",
            text: "Copier l'analyse",
            title: "Copier l'analyse",
            style: { background: "#4a5e81", color: "white", border: "1px solid #3a4d6a" }
        },
        COPY_RIS: {
            id: "copy-ris",
            className: "options-item type-copy-ris",
            icon: "📋",
            text: "Copier RIS",
            title: "Copier la référence RIS",
            style: { background: "#4a5e81", color: "white", border: "1px solid #3a4d6a" }
        },
        IMPORT_COMPLETE: {
            id: "import-complete",
            className: "options-item type-copy-ris-complete", 
            icon: "📚",
            text: "Importer RIS complet",
            title: "Copier RIS complet avec texte et analyse ou importer dans Zotero",
            style: { background: "#2d5a27", color: "white", border: "1px solid #1f3e1b" }
        }
    },

    // Initialiser les boutons pour un extracteur donné
    async initialize(extractor) {
        if (!extractor || !extractor.isCompatible) {
            console.log("Extracteur non compatible, pas d'ajout de boutons");
            return false;
        }

        const optionsList = await this._findOptionsContainer();
        if (!optionsList) {
            console.log("Container des options non trouvé");
            return false;
        }

        // Vérifier si les boutons sont déjà présents
        if (this._buttonsAlreadyAdded(optionsList)) {
            console.log("Boutons déjà présents");
            return true;
        }

        this._createAllButtons(optionsList, extractor);
        console.log("Tous les boutons ont été ajoutés avec succès");
        return true;
    },

    // Trouver le container des options
    async _findOptionsContainer() {
        // Attendre que l'élément soit disponible
        return await window.DOMHelpers.waitForElement(".options-list", 10000);
    },

    // Vérifier si les boutons sont déjà ajoutés
    _buttonsAlreadyAdded(container) {
        return container.querySelector(".type-copy-decision") !== null;
    },

    // Créer tous les boutons
    _createAllButtons(container, extractor) {
        const buttons = [];
        
        // Créer chaque bouton
        Object.values(this.BUTTONS).forEach(config => {
            const buttonElement = this._createButton(config, extractor);
            buttons.push(buttonElement);
        });

        // Ajouter les boutons au container
        this._addButtonsToContainer(container, buttons);
    },

    // Créer un bouton individuel
    _createButton(config, extractor) {
        const li = document.createElement("li");
        li.className = config.className;
        
        const styleString = Object.entries(config.style)
            .map(([key, value]) => `${key}: ${value}`)
            .join("; ");

        li.innerHTML = `
            <button type="button" class="options-cta" title="${config.title}" 
                    style="${styleString}; padding: 8px 12px;">
                <span class="icon" aria-hidden="true">${config.icon}</span>
                <span class="text">${config.text}</span>
            </button>
        `;

        // Ajouter les gestionnaires d'événements
        this._attachEventListener(li, config.id, extractor);
        
        return li;
    },

    // Attacher les gestionnaires d'événements
    _attachEventListener(buttonElement, buttonId, extractor) {
        const button = buttonElement.querySelector("button");
        
        button.addEventListener("click", async () => {
            await this._handleButtonClick(buttonId, extractor);
        });
    },

    // Gérer les clics sur les boutons
    async _handleButtonClick(buttonId, extractor) {
        try {
            switch (buttonId) {
                case "copy-decision":
                    await this._handleCopyDecision(extractor);
                    break;
                case "copy-analysis":
                    await this._handleCopyAnalysis(extractor);
                    break;
                case "copy-ris":
                    await this._handleCopyRIS(extractor);
                    break;
                case "import-complete":
                    await this._handleImportComplete(extractor);
                    break;
                default:
                    window.NotificationManager.error("Action non reconnue");
            }
        } catch (error) {
            console.error("Erreur lors du traitement du bouton:", error);
            window.NotificationManager.error("Une erreur s'est produite");
        }
    },

    // Gestionnaire: Copier la décision
    async _handleCopyDecision(extractor) {
    const text = await extractor.extractDecisionText();
    const formattedText = extractor.formatDecisionText(text);
    
    if (formattedText) {
        const success = await window.ClipboardManager.copy(formattedText);
        window.NotificationManager[success ? "success" : "error"](
            success ? "Arrêt copié !" : "Erreur de copie"
        );
    } else {
        window.NotificationManager.error("Impossible d'extraire l'arrêt");
    }
},

    // Gestionnaire: Copier l'analyse
    async _handleCopyAnalysis(extractor) {
        const text = extractor.extractAnalysis();
        
        if (text) {
            const success = await window.ClipboardManager.copy(text);
            window.NotificationManager[success ? "success" : "error"](
                success ? "Analyse copiée !" : "Erreur de copie"
            );
        } else {
            window.NotificationManager.error("Impossible d'extraire l'analyse");
        }
    },

    // Gestionnaire: Copier le RIS
    async _handleCopyRIS(extractor) {
        const ris = extractor.generateBasicRIS();
        
        if (ris) {
            const success = await window.ClipboardManager.copy(ris);
            window.NotificationManager[success ? "success" : "error"](
                success ? "RIS copié !" : "Erreur de copie"
            );
        } else {
            window.NotificationManager.error("Impossible de générer le RIS");
        }
    },

    // Gestionnaire: Import complet
    async _handleImportComplete(extractor) {
    const risComplete = await extractor.generateCompleteRIS();
    
    if (!risComplete) {
        window.NotificationManager.error("Impossible de générer le RIS complet");
        return;
    }

    // Tentative d'import Zotero avec fallback vers copie
    const result = await window.ZoteroIntegration.importWithConfirmation(risComplete);
    
    if (result.action === "copy" || (result.action === "imported" && !result.success)) {
        // Fallback: copier dans le presse-papiers
        const copySuccess = await window.ClipboardManager.copy(risComplete);
        const message = copySuccess ? result.message : "Erreur d'import et de copie";
        window.NotificationManager[copySuccess ? "warning" : "error"](message);
    } else {
        // Import réussi ou annulé
        const type = result.success ? "success" : "info";
        window.NotificationManager[type](result.message);
    }
},

    // Ajouter les boutons au container
    _addButtonsToContainer(container, buttons) {
        const printButton = container.querySelector(".type-print");
        
        buttons.forEach(button => {
            if (printButton) {
                container.insertBefore(button, printButton);
            } else {
                container.appendChild(button);
            }
        });
    }
};