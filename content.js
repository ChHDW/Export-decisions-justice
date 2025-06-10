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

            // Initialiser l'interface utilisateur
            const uiSuccess = await initializeUI();
            if (!uiSuccess) {
                return false;
            }

            isInitialized = true;
            console.log("🎉 Extension initialisée avec succès !");
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
        
        // Futurs sites à ajouter :
        // if (url.includes("curia.europa.eu")) {
        //     return new window.CuriaExtractor();
        // }
        // if (url.includes("arianeweb")) {
        //     return new window.ArianeWebExtractor();
        // }
        
        return null;
    }

    // Initialiser l'interface utilisateur
    async function initializeUI() {
        let retries = 0;
        
        while (retries < APP_CONFIG.maxRetries) {
            try {
                const success = await window.ButtonManager.initialize(currentExtractor);
                if (success) {
                    return true;
                }
                
                retries++;
                if (retries < APP_CONFIG.maxRetries) {
                    console.log(`⏳ Tentative ${retries}/${APP_CONFIG.maxRetries} échouée, nouvelle tentative dans ${APP_CONFIG.retryDelay}ms`);
                    await new Promise(resolve => setTimeout(resolve, APP_CONFIG.retryDelay));
                }
                
            } catch (error) {
                console.error(`❌ Erreur lors de la tentative ${retries + 1}:`, error);
                retries++;
            }
        }
        
        console.error("❌ Échec de l'initialisation de l'UI après toutes les tentatives");
        return false;
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
        testExtraction: () => {
            if (!currentExtractor) return null;
            
            return {
                metadata: currentExtractor.extractMetadata(),
                decisionText: currentExtractor.extractDecisionText()?.substring(0, 200) + "...",
                analysisText: currentExtractor.extractAnalysis()?.substring(0, 200) + "...",
                basicRIS: currentExtractor.generateBasicRIS(),
                validation: currentExtractor.validateExtraction()
            };
        }
    };

    // Fonction de démarrage principal
    function startup() {
        console.log("🚀 Démarrage de l'extension...");
        
        // Configurer la détection des changements de page
        setupPageChangeDetection();
        
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