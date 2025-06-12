// Point d'entrée principal de l'extension - Orchestrateur
console.log("🚀 Extension Jurisprudence chargée !", window.location.href);

(function() {
    "use strict";

    // Configuration globale
    const APP_CONFIG = {
        name: "Extension Jurisprudence",
        version: "2.0",
        retryDelay: 2000,
        maxRetries: 3
    };

    // État de l'application
    let currentExtractor = null;
    let isInitialized = false;

    // Fonction principale d'initialisation
    async function initialize() {
        try {
            console.log(`🔍 Initialisation de ${APP_CONFIG.name} v${APP_CONFIG.version}`);
            
            // Attendre que la page soit complètement chargée
            await window.DOMHelpers.waitForPage();
            console.log("✅ Page complètement chargée");

            // Détecter et créer l'extracteur approprié
            currentExtractor = detectAndCreateExtractor();
            
            if (!currentExtractor) {
                console.log("❌ Aucun extracteur compatible trouvé");
                return false;
            }

            console.log(`✅ Extracteur ${currentExtractor.siteName} initialisé`);

            // Valider que l'extraction fonctionne
            const validation = currentExtractor.validateExtraction();
            if (!validation.isValid) {
                console.warn("⚠️ Validation échouée:", validation.missingFields);
                // Continue quand même, certains champs peuvent être optionnels
            }

            isInitialized = true;
            console.log("🎉 Extension initialisée avec succès ! Popup disponible via l'icône d'extension.");
            return true;

        } catch (error) {
            console.error("❌ Erreur lors de l'initialisation:", error);
            showInitializationError(error);
            return false;
        }
    }

    // Détecter le site et créer l'extracteur approprié
    function detectAndCreateExtractor() {
        const url = window.location.href;
        
        // Légifrance
        if (url.includes("legifrance.gouv.fr")) {
            return new window.LegifranceExtractor();
        }
        
        // Curia (CJUE)
        if (url.includes("curia.europa.eu")) {
            return new window.CuriaExtractor();
        }
        
        // Futurs sites à ajouter :
        // if (url.includes("arianeweb")) {
        //     return new window.ArianeWebExtractor();
        // }
        
        return null;
    }

    // Afficher une erreur d'initialisation à l'utilisateur
    function showInitializationError(error) {
        if (window.NotificationManager) {
            window.NotificationManager.error(
                "Impossible d'initialiser l'extension. Veuillez recharger la page.",
                5000
            );
        }
    }

    // Gestionnaire d'événements pour les changements de page (SPA)
    function handlePageChange() {
        // Réinitialiser si on change de page
        if (isInitialized) {
            console.log("🔄 Changement de page détecté, réinitialisation...");
            isInitialized = false;
            currentExtractor = null;
            
            // Redémarrer l'initialisation après un court délai
            setTimeout(initialize, 1000);
        }
    }

    // Écouter les changements d'URL pour les SPAs
    function setupPageChangeDetection() {
        // Écouter les changements d'historique
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(...args) {
            originalPushState.apply(history, args);
            handlePageChange();
        };
        
        history.replaceState = function(...args) {
            originalReplaceState.apply(history, args);
            handlePageChange();
        };
        
        // Écouter les événements popstate
        window.addEventListener("popstate", handlePageChange);
    }

    // API publique pour le debugging et les tests
    window.JurisprudenceExtension = {
        getConfig: () => APP_CONFIG,
        getCurrentExtractor: () => currentExtractor,
        isInitialized: () => isInitialized,
        reinitialize: initialize,
        
        // Méthodes de test
        testExtraction: async () => {
            if (!currentExtractor) return null;
            
            try {
                const metadata = currentExtractor.extractMetadata();
                
                // Gérer les méthodes asynchrones et synchrones
                let decisionText = null;
                let analysisText = null;
                
                try {
                    const decisionResult = currentExtractor.extractDecisionText();
                    if (decisionResult && typeof decisionResult.then === 'function') {
                        decisionText = await decisionResult;
                    } else {
                        decisionText = decisionResult;
                    }
                } catch (error) {
                    console.warn("Erreur extraction texte:", error);
                }
                
                try {
                    const analysisResult = currentExtractor.extractAnalysis();
                    if (analysisResult && typeof analysisResult.then === 'function') {
                        analysisText = await analysisResult;
                    } else {
                        analysisText = analysisResult;
                    }
                } catch (error) {
                    console.warn("Erreur extraction analyse:", error);
                }
                
                return {
                    metadata: metadata,
                    decisionText: decisionText?.substring(0, 200) + "...",
                    analysisText: analysisText?.substring(0, 200) + "...",
                    basicRIS: currentExtractor.generateBasicRIS(),
                    validation: currentExtractor.validateExtraction()
                };
            } catch (error) {
                console.error("Erreur lors du test d'extraction:", error);
                return { error: error.message };
            }
        }
    };

    // Système de communication avec la popup
    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            handlePopupMessage(request, sendResponse);
            return true; // Garde la connexion ouverte pour les réponses asynchrones
        });
    }

    // Gestionnaire de messages depuis la popup
    async function handlePopupMessage(request, sendResponse) {
        try {
            switch (request.action) {
                case "checkCompatibility":
                    const compatibilityInfo = {
                        compatible: isInitialized && currentExtractor && currentExtractor.isCompatible,
                        siteName: currentExtractor ? currentExtractor.siteName : null,
                        url: window.location.href
                    };
                    sendResponse(compatibilityInfo);
                    break;

                case "copyDecision":
                    const decisionResult = await handleCopyDecision();
                    sendResponse(decisionResult);
                    break;

                case "copyAnalysis":
                    const analysisResult = await handleCopyAnalysis();
                    sendResponse(analysisResult);
                    break;

                case "copyRis":
                    const risResult = await handleCopyRIS();
                    sendResponse(risResult);
                    break;

                case "importComplete":
                    const importResult = await handleImportComplete();
                    sendResponse(importResult);
                    break;

                default:
                    sendResponse({ success: false, message: "Action non reconnue" });
            }
        } catch (error) {
            console.error("Erreur lors du traitement du message:", error);
            sendResponse({ success: false, message: "Erreur interne" });
        }
    }

    // Gestionnaires d'actions pour la popup
    async function handleCopyDecision() {
        if (!currentExtractor) {
            return { success: false, message: "Extracteur non disponible" };
        }

        try {
            // Gérer les extracteurs asynchrones et synchrones
            const decisionResult = currentExtractor.extractDecisionText();
            let text = null;
            
            if (decisionResult && typeof decisionResult.then === 'function') {
                // Méthode asynchrone (Curia)
                text = await decisionResult;
            } else {
                // Méthode synchrone (Légifrance)
                text = decisionResult;
            }
            
            const formattedText = currentExtractor.formatDecisionText(text);
            
            if (formattedText) {
                const success = await window.ClipboardManager.copy(formattedText);
                return {
                    success: success,
                    message: success ? "Arrêt copié !" : "Erreur de copie"
                };
            } else {
                return { success: false, message: "Impossible d'extraire l'arrêt" };
            }
        } catch (error) {
            console.error("Erreur lors de la copie de l'arrêt:", error);
            return { success: false, message: "Erreur lors de l'extraction de l'arrêt" };
        }
    }

    async function handleCopyAnalysis() {
        if (!currentExtractor) {
            return { success: false, message: "Extracteur non disponible" };
        }

        try {
            // Gérer les extracteurs asynchrones et synchrones
            const analysisResult = currentExtractor.extractAnalysis();
            let text = null;
            
            if (analysisResult && typeof analysisResult.then === 'function') {
                // Méthode asynchrone
                text = await analysisResult;
            } else {
                // Méthode synchrone
                text = analysisResult;
            }
            
            if (text) {
                const success = await window.ClipboardManager.copy(text);
                return {
                    success: success,
                    message: success ? "Analyse copiée !" : "Erreur de copie"
                };
            } else {
                return { success: false, message: "Impossible d'extraire l'analyse" };
            }
        } catch (error) {
            console.error("Erreur lors de la copie de l'analyse:", error);
            return { success: false, message: "Erreur lors de l'extraction de l'analyse" };
        }
    }

    async function handleCopyRIS() {
        if (!currentExtractor) {
            return { success: false, message: "Extracteur non disponible" };
        }

        try {
            const ris = currentExtractor.generateBasicRIS();
            
            if (ris) {
                const success = await window.ClipboardManager.copy(ris);
                return {
                    success: success,
                    message: success ? "RIS copié !" : "Erreur de copie"
                };
            } else {
                return { success: false, message: "Impossible de générer le RIS" };
            }
        } catch (error) {
            console.error("Erreur lors de la copie du RIS:", error);
            return { success: false, message: "Erreur lors de la génération du RIS" };
        }
    }

    async function handleImportComplete() {
        if (!currentExtractor) {
            return { success: false, message: "Extracteur non disponible" };
        }

        try {
            // Gérer les extracteurs asynchrones et synchrones
            const risResult = currentExtractor.generateCompleteRIS();
            let risComplete = null;
            
            if (risResult && typeof risResult.then === 'function') {
                // Méthode asynchrone
                risComplete = await risResult;
            } else {
                // Méthode synchrone
                risComplete = risResult;
            }
            
            if (!risComplete) {
                return { success: false, message: "Impossible de générer le RIS complet" };
            }

            // Tentative d'import Zotero avec fallback vers copie
            const result = await window.ZoteroIntegration.importWithConfirmation(risComplete);
            
            if (result.action === "copy" || (result.action === "imported" && !result.success)) {
                // Fallback: copier dans le presse-papiers
                const copySuccess = await window.ClipboardManager.copy(risComplete);
                return {
                    success: copySuccess,
                    message: copySuccess ? result.message : "Erreur d'import et de copie"
                };
            } else {
                // Import réussi ou annulé
                return {
                    success: result.success || result.action === "cancelled",
                    message: result.message
                };
            }
        } catch (error) {
            console.error("Erreur lors de l'import complet:", error);
            return { success: false, message: "Erreur lors de l'import complet" };
        }
    }

    // Fonction de démarrage principal
    function startup() {
        console.log("🚀 Démarrage de l'extension...");
        
        // Configurer la détection des changements de page
        setupPageChangeDetection();
        
        // Configurer l'écoute des messages depuis la popup
        setupMessageListener();
        
        // Démarrer l'initialisation
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", initialize);
        } else {
            // Le DOM est déjà chargé
            initialize();
        }
    }

    // Point d'entrée
    startup();

})();