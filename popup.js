// JavaScript pour la popup de l'extension
(function() {
    "use strict";

    // État de l'application
    let currentTab = null;
    let extractorInfo = null;

    // Éléments DOM
    const elements = {
        siteName: document.getElementById('site-name'),
        status: document.getElementById('status'),
        statusText: document.getElementById('status-text'),
        loading: document.getElementById('loading'),
        actions: document.getElementById('actions'),
        buttons: {
            copyDecision: document.getElementById('copy-decision'),
            copyAnalysis: document.getElementById('copy-analysis'),
            copyRis: document.getElementById('copy-ris'),
            importComplete: document.getElementById('import-complete')
        }
    };

    // Initialisation de la popup
    async function initialize() {
        try {
            // Obtenir l'onglet actuel
            currentTab = await getCurrentTab();
            
            // Vérifier la compatibilité avec le site
            await checkCompatibility();
            
            // Configurer les événements
            setupEventListeners();
            
        } catch (error) {
            console.error("Erreur lors de l'initialisation:", error);
            showError("Erreur d'initialisation");
        }
    }

    // Obtenir l'onglet actuel
    function getCurrentTab() {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                resolve(tabs[0]);
            });
        });
    }

    // Vérifier la compatibilité avec le site actuel
    async function checkCompatibility() {
        if (!currentTab) {
            showError("Impossible d'accéder à l'onglet");
            return;
        }

        try {
            // Envoyer un message au content script pour vérifier la compatibilité
            const response = await sendMessageToTab({
                action: "checkCompatibility"
            });

            if (response && response.compatible) {
                extractorInfo = response;
                showCompatible(response);
            } else {
                showIncompatible(currentTab.url);
            }
        } catch (error) {
            console.error("Erreur de communication:", error);
            showIncompatible(currentTab.url);
        }
    }

    // Envoyer un message au content script
    function sendMessageToTab(message) {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(currentTab.id, message, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn("Erreur de message:", chrome.runtime.lastError);
                    resolve(null);
                } else {
                    resolve(response);
                }
            });
        });
    }

    // Afficher l'état compatible
    function showCompatible(info) {
        elements.siteName.textContent = info.siteName || "Site détecté";
        elements.status.className = "status compatible";
        elements.statusText.textContent = `✅ Compatible - ${info.siteName}`;
        
        elements.loading.style.display = "none";
        elements.actions.style.display = "block";

        // Activer/désactiver les boutons selon les capacités
        updateButtonStates(info);
    }

    // Afficher l'état incompatible
    function showIncompatible(url) {
        const siteName = extractSiteName(url);
        elements.siteName.textContent = siteName;
        elements.status.className = "status incompatible";
        elements.statusText.textContent = "❌ Site non supporté";
        
        elements.loading.style.display = "none";
        elements.actions.style.display = "none";
    }

    // Afficher une erreur
    function showError(message) {
        elements.siteName.textContent = "Erreur";
        elements.status.className = "status incompatible";
        elements.statusText.textContent = `❌ ${message}`;
        
        elements.loading.style.display = "none";
        elements.actions.style.display = "none";
    }

    // Extraire le nom du site depuis l'URL
    function extractSiteName(url) {
        if (url.includes("legifrance.gouv.fr")) return "Légifrance";
        if (url.includes("curia.europa.eu")) return "Curia (CJUE)";
        if (url.includes("arianeweb")) return "ArianeWeb";
        
        try {
            return new URL(url).hostname;
        } catch {
            return "Site inconnu";
        }
    }

    // Mettre à jour l'état des boutons
    function updateButtonStates(info) {
        // Pour l'instant, tous les boutons sont activés si compatible
        // Plus tard, on pourra désactiver certains boutons selon les capacités
        const buttons = Object.values(elements.buttons);
        buttons.forEach(button => {
            button.disabled = false;
        });

        // Masquer les boutons non supportés pour certains sites
        if (info.siteName === "Curia") {
            // Curia ne supporte pas encore l'extraction de texte
            elements.buttons.copyDecision.disabled = true;
            elements.buttons.copyAnalysis.disabled = true;
        }
    }

    // Configurer les gestionnaires d'événements
    function setupEventListeners() {
        elements.buttons.copyDecision.addEventListener('click', () => {
            executeAction('copyDecision');
        });

        elements.buttons.copyAnalysis.addEventListener('click', () => {
            executeAction('copyAnalysis');
        });

        elements.buttons.copyRis.addEventListener('click', () => {
            executeAction('copyRis');
        });

        elements.buttons.importComplete.addEventListener('click', () => {
            executeAction('importComplete');
        });
    }

    // Exécuter une action
    async function executeAction(actionType) {
        const button = elements.buttons[actionType];
        if (!button || button.disabled) return;

        // Indiquer que l'action est en cours
        const originalText = button.querySelector('.text > div').textContent;
        button.querySelector('.text > div').textContent = "⏳ En cours...";
        button.disabled = true;

        try {
            const response = await sendMessageToTab({
                action: actionType
            });

            if (response && response.success) {
                showNotification(response.message || "Action réussie !", "success");
                
                // Fermer la popup après succès (optionnel)
                setTimeout(() => {
                    window.close();
                }, 1500);
            } else {
                showNotification(response?.message || "Action échouée", "error");
            }
        } catch (error) {
            console.error(`Erreur lors de ${actionType}:`, error);
            showNotification("Erreur de communication", "error");
        } finally {
            // Restaurer le bouton
            button.querySelector('.text > div').textContent = originalText;
            button.disabled = false;
        }
    }

    // Afficher une notification
    function showNotification(message, type = "success") {
        // Supprimer les notifications existantes
        const existingNotifs = document.querySelectorAll('.notification');
        existingNotifs.forEach(notif => notif.remove());

        // Créer la nouvelle notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Animer l'entrée
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Supprimer après délai
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Lancement de l'initialisation
    document.addEventListener('DOMContentLoaded', initialize);

})();