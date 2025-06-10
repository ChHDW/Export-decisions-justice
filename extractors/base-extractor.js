// Classe de base pour tous les extracteurs de contenu juridique
window.BaseExtractor = class {
    
    constructor(siteName) {
        this.siteName = siteName;
        this.isCompatible = false;
    }

    // Méthodes à implémenter dans les classes filles
    
    // Vérifier si on est sur une page compatible
    checkCompatibility() {
        throw new Error("checkCompatibility() doit être implémentée");
    }

    // Extraire les métadonnées de base
    extractMetadata() {
        throw new Error("extractMetadata() doit être implémentée");
    }

    // Extraire le texte de la décision
    extractDecisionText() {
        throw new Error("extractDecisionText() doit être implémentée");
    }

    // Extraire l'analyse/résumé
    extractAnalysis() {
        throw new Error("extractAnalysis() doit être implémentée");
    }

    // Méthodes communes disponibles pour toutes les classes filles

    // Formater le texte de décision avec mise en forme améliorée
    formatDecisionText(rawText) {
        if (!rawText) return null;

        let text = rawText;
        
        // Améliorer la structure du texte
        text = text.replace(/;\s*\n/g, ";\n\n"); // Sauts après points-virgules
        text = text.replace(/:\s*\n/g, ":\n\n"); // Sauts après deux-points
        text = text.replace(/Considérant/g, "\n\nConsidérant"); // Séparer les considérants
        text = text.replace(/Article \d+/g, "\n\n$&"); // Séparer les articles
        text = text.replace(/DECIDE|DÉCIDE/g, "\n\n$&"); // Séparer les décisions
        text = text.replace(/PAR CES MOTIFS/g, "\n\n$&"); // Séparer les motifs
        
        return window.DOMHelpers.cleanText(text);
    }

    // Extraire la date au format standardisé
    parseDate(dateText) {
        if (!dateText) return null;
        
        // Expressions régulières pour différents formats de date
        const patterns = [
            /(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i,
            /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
            /(\d{4})-(\d{1,2})-(\d{1,2})/
        ];
        
        for (const pattern of patterns) {
            const match = dateText.match(pattern);
            if (match) {
                return {
                    original: match[0],
                    formatted: match[0], // Peut être personnalisé selon le besoin
                    year: this._extractYear(match)
                };
            }
        }
        
        return null;
    }

    // Extraire l'année d'une correspondance de date
    _extractYear(match) {
        // Chercher un groupe de 4 chiffres dans la correspondance
        for (let i = 1; i < match.length; i++) {
            if (match[i] && match[i].length === 4 && /^\d{4}$/.test(match[i])) {
                return match[i];
            }
        }
        return null;
    }

    // Nettoyer un numéro d'arrêt
    cleanDecisionNumber(numberText) {
        if (!numberText) return null;
        
        return numberText
            .replace(/^N°?\s*/, "") // Supprimer "N°" au début
            .replace(/\s+/g, " ") // Normaliser les espaces
            .trim();
    }

    // Générer l'URL actuelle
    getCurrentUrl() {
        return window.location.href;
    }

    // Méthodes publiques utilisées par l'interface

    // Générer un RIS de base
    generateBasicRIS() {
        const metadata = this.extractMetadata();
        if (!metadata) return null;
        
        return window.RISGenerator.generateBasic(metadata);
    }

    // Générer un RIS complet
    generateCompleteRIS() {
        const metadata = this.extractMetadata();
        const decisionText = this.extractDecisionText();
        const analysisText = this.extractAnalysis();
        
        if (!metadata) return null;
        
        const content = {
            decisionText: this.formatDecisionText(decisionText),
            analysisText
        };
        
        return window.RISGenerator.generateComplete(metadata, content);
    }

    // Vérifier que toutes les données essentielles sont présentes
    validateExtraction() {
        const metadata = this.extractMetadata();
        return window.RISGenerator.validateMetadata(metadata);
    }

    // Log de débogage spécifique au site
    log(message, data = null) {
        console.log(`[${this.siteName}] ${message}`, data || "");
    }
};