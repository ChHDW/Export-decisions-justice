// Système de notifications
window.NotificationManager = {
    
    // Types de notifications
    TYPES: {
        SUCCESS: "success",
        ERROR: "error",
        WARNING: "warning",
        INFO: "info"
    },

    // Afficher une notification
    show(message, type = this.TYPES.INFO, duration = 3000) {
        const notification = this._createNotification(message, type);
        document.body.appendChild(notification);
        
        // Animation d'entrée
        setTimeout(() => {
            notification.style.transform = "translateX(0)";
            notification.style.opacity = "1";
        }, 10);
        
        // Suppression automatique
        setTimeout(() => {
            this._removeNotification(notification);
        }, duration);
        
        return notification;
    },

    // Créer l'élément de notification
    _createNotification(message, type) {
        const notification = document.createElement("div");
        
        const colors = {
            [this.TYPES.SUCCESS]: { bg: "#2d5a27", border: "#1f3e1b" },
            [this.TYPES.ERROR]: { bg: "#d32f2f", border: "#b71c1c" },
            [this.TYPES.WARNING]: { bg: "#f57c00", border: "#e65100" },
            [this.TYPES.INFO]: { bg: "#1976d2", border: "#0d47a1" }
        };
        
        const color = colors[type] || colors[this.TYPES.INFO];
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${color.bg};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            border-left: 4px solid ${color.border};
            z-index: 10000;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-width: 300px;
            word-wrap: break-word;
            transform: translateX(100%);
            opacity: 0;
            transition: all 0.3s ease;
            cursor: pointer;
        `;
        
        notification.textContent = message;
        
        // Permettre la fermeture en cliquant
        notification.addEventListener("click", () => {
            this._removeNotification(notification);
        });
        
        return notification;
    },

    // Supprimer une notification
    _removeNotification(notification) {
        if (!notification.parentNode) return;
        
        notification.style.transform = "translateX(100%)";
        notification.style.opacity = "0";
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    },

    // Méthodes de convenance
    success(message, duration) {
        return this.show(message, this.TYPES.SUCCESS, duration);
    },

    error(message, duration) {
        return this.show(message, this.TYPES.ERROR, duration);
    },

    warning(message, duration) {
        return this.show(message, this.TYPES.WARNING, duration);
    },

    info(message, duration) {
        return this.show(message, this.TYPES.INFO, duration);
    }
};