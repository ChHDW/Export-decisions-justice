// Extracteur spécifique pour Légifrance
window.LegifranceExtractor = class extends window.BaseExtractor {
    
    constructor() {
        super("Légifrance");
        this.isCompatible = this.checkCompatibility();
    }

    // Vérifier si on est sur une page Légifrance compatible
    checkCompatibility() {
        const url = window.location.href;
        const isLegifrance = url.includes("legifrance.gouv.fr");
        const isDecisionPage = url.includes("/ceta/id/") || 
                              url.includes("/juri/id/") || 
                              url.includes("/constit/id/") || 
                              url.includes("/jufi/id/");
        
        const compatible = isLegifrance && isDecisionPage;
        this.log("Vérification de compatibilité", { url, compatible });
        
        return compatible;
    }

    // Extraire les métadonnées spécifiques à Légifrance
    extractMetadata() {
        const metadata = {
            site: this.siteName,
            url: this.getCurrentUrl()
        };
        
        try {
            // Titre principal
            const mainTitle = document.querySelector(".main-title");
            if (mainTitle) {
                metadata.fullTitle = mainTitle.textContent.trim();
            }
            
            // Juridiction et formation de jugement
            const jurisdictionElement = document.querySelector(".frame-block.print-sommaire h2.title.horsAbstract");
            if (jurisdictionElement) {
                const fullText = jurisdictionElement.textContent.trim();
                const parts = fullText.split("-");
                
                if (parts.length >= 2) {
                    const courtFull = parts[0].trim();
                    const formation = parts[1].trim();
                    
                    // Utiliser le générateur RIS pour standardiser le nom de la cour
                    const courtStandardized = window.RISGenerator.standardizeCourtName(courtFull, "legifrance");
                    metadata.court = formation ? `${courtStandardized}, ${formation}` : courtStandardized;
                    metadata.courtFull = courtFull;
                    metadata.formation = formation;
                } else {
                    metadata.courtFull = fullText;
                    metadata.court = window.RISGenerator.standardizeCourtName(fullText, "legifrance");
                }
            }
            
            // Date de lecture
            const dateElement = document.querySelector(".frame-block.print-sommaire .h2.title.horsAbstract");
            if (dateElement) {
                const dateInfo = this.parseDate(dateElement.textContent);
                if (dateInfo) {
                    metadata.date = dateInfo.formatted;
                    metadata.year = dateInfo.year;
                }
            }
            
            // Numéro de décision et informations de publication
            const infoList = document.querySelectorAll(".frame-block.print-sommaire ul li");
            infoList.forEach(li => {
                const text = li.textContent.trim();
                
                if (text.startsWith("N°")) {
                    metadata.number = `n°${this.cleanDecisionNumber(text)}`;
                }
                
                if (text.includes("recueil") || text.includes("Lebon") || 
                    text.includes("publié") || text.includes("mentionné")) {
                    metadata.publication = text;
                }
            });
            
            this.log("Métadonnées extraites", metadata);
            return metadata;
            
        } catch (error) {
            this.log("Erreur lors de l'extraction des métadonnées", error);
            return null;
        }
    }

    // Extraire le texte de la décision
    extractDecisionText() {
        try {
            const contentPage = document.querySelector(".content-page");
            if (!contentPage) {
                this.log("Element .content-page non trouvé");
                return null;
            }
            
            const clone = contentPage.cloneNode(true);
            
            // Supprimer le titre h2.title
            const titleH2 = clone.querySelector("h2.title");
            if (titleH2) titleH2.remove();
            
            const rawText = window.DOMHelpers.extractTextFromElement(clone);
            this.log("Texte de décision extrait", { longueur: rawText?.length });
            
            return rawText;
            
        } catch (error) {
            this.log("Erreur lors de l'extraction du texte", error);
            return null;
        }
    }

    // Extraire l'analyse (abstrats et résumé)
    extractAnalysis() {
        try {
            const analysisBlock = document.querySelector(".frame-block.abstract");
            if (!analysisBlock) {
                this.log("Bloc d'analyse non trouvé");
                return null;
            }

            let analysisText = "";
            
            // Chercher tous les contenus d'analyse
            const textContents = analysisBlock.querySelectorAll(".js-child.texte");
            textContents.forEach((content, index) => {
                const text = content.textContent.trim();
                if (text) {
                    if (index > 0) {
                        analysisText += "\n\n";
                    }
                    analysisText += text;
                }
            });
            
            const result = analysisText.trim() || null;
            this.log("Analyse extraite", { longueur: result?.length });
            
            return result;
            
        } catch (error) {
            this.log("Erreur lors de l'extraction de l'analyse", error);
            return null;
        }
    }

    // Méthodes spécifiques à Légifrance

    // Identifier le type de juridiction
    getJurisdictionType() {
        const url = this.getCurrentUrl();
        
        if (url.includes("/ceta/")) return "administratif";
        if (url.includes("/juri/")) return "judiciaire";
        if (url.includes("/constit/")) return "constitutionnel";
        if (url.includes("/jufi/")) return "financier";
        
        return "inconnu";
    }

    // Extraire les informations sur les personnalités (président, rapporteur, etc.)
    extractPersonalities() {
        const personalities = {};
        
        try {
            // Président et Rapporteur
            const dlElements = document.querySelectorAll(".frame-block.print-sommaire dl");
            dlElements.forEach(dl => {
                const dt = dl.querySelector("dt");
                const dd = dl.querySelector("dd");
                
                if (dt && dd) {
                    const role = dt.textContent.trim().toLowerCase();
                    const name = dd.textContent.trim();
                    
                    if (role.includes("président")) {
                        personalities.president = name;
                    } else if (role.includes("rapporteur")) {
                        personalities.rapporteur = name;
                    }
                }
            });
            
            // Commissaire du gouvernement (structure différente)
            const commissaireElement = document.querySelector(".frame-block.print-sommaire dt");
            if (commissaireElement && commissaireElement.textContent.includes("Commissaire")) {
                const ddElement = commissaireElement.nextElementSibling;
                if (ddElement && ddElement.tagName === "DD") {
                    personalities.commissaire = ddElement.textContent.trim();
                }
            }
            
        } catch (error) {
            this.log("Erreur lors de l'extraction des personnalités", error);
        }
        
        return personalities;
    }
};