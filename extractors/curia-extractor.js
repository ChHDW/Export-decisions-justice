// Extracteur spécifique pour Curia (CJUE)
window.CuriaExtractor = class extends window.BaseExtractor {
    
    constructor() {
        super("Curia");
        this.isCompatible = this.checkCompatibility();
    }

    // Vérifier si on est sur une page Curia compatible
    checkCompatibility() {
        const url = window.location.href;
        const isCuria = url.includes("curia.europa.eu");
        const isListePage = url.includes("/liste.jsf") || url.includes("/document/document.jsf");
        
        // Vérifier qu'on a au moins une affaire affichée
        const hasCase = document.querySelector(".affaire_title") !== null ||
                       document.querySelector(".outputEcliAff") !== null;
        
        const compatible = isCuria && (isListePage && hasCase);
        this.log("Vérification de compatibilité", { url, compatible, hasCase });
        
        return compatible;
    }

    // Extraire les métadonnées spécifiques à Curia
    extractMetadata() {
        const metadata = {
            site: this.siteName,
            url: this.getCurrentUrl()
        };
        
        try {
            // Extraire le titre de l'affaire (numéro + nom du requérant)
            const affaireTitleElement = document.querySelector(".affaire_title");
            if (affaireTitleElement) {
                const fullTitle = affaireTitleElement.textContent.trim();
                // Format attendu: "C-278/22 - AUTOTECHNICA FLEET SERVICES"
                const titleParts = fullTitle.split(" - ");
                
                if (titleParts.length >= 2) {
                    metadata.caseNumber = titleParts[0].trim(); // "C-278/22"
                    metadata.caseName = titleParts[1].trim(); // "AUTOTECHNICA FLEET SERVICES"
                    metadata.fullTitle = fullTitle;
                }
            }

            // Extraire les informations de la décision
            const decisionTitleElement = document.querySelector(".decision_title");
            if (decisionTitleElement) {
                const decisionText = decisionTitleElement.textContent.trim();
                
                // Extraire le type de document (Arrêt, Conclusions, etc.)
                const docTypeMatch = decisionText.match(/^(Arrêt|Conclusions|Ordonnance)/);
                if (docTypeMatch) {
                    metadata.documentType = docTypeMatch[1];
                }
                
                // Extraire la date (format: "21/12/2023")
                const dateMatch = decisionText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
                if (dateMatch) {
                    const dateParts = dateMatch[1].split("/");
                    metadata.date = dateMatch[1];
                    metadata.year = dateParts[2];
                    // Convertir au format RIS (YYYY/MM/DD)
                    metadata.dateRIS = `${dateParts[2]}/${dateParts[1].padStart(2, '0')}/${dateParts[0].padStart(2, '0')}`;
                }
            }

            // Extraire l'ECLI
            const ecliElement = document.querySelector(".outputEcliAff");
            if (ecliElement) {
                metadata.ecli = ecliElement.textContent.trim();
            }

            // Déterminer la juridiction à partir du numéro d'affaire
            if (metadata.caseNumber) {
                metadata.court = this.determineCourtFromCaseNumber(metadata.caseNumber);
                metadata.number = `aff. ${metadata.caseNumber}`;
            }

            // Extraire les liens vers les documents
            metadata.documentLinks = this.extractDocumentLinks();

            this.log("Métadonnées extraites", metadata);
            return metadata;
            
        } catch (error) {
            this.log("Erreur lors de l'extraction des métadonnées", error);
            return null;
        }
    }

    // Déterminer la juridiction à partir du numéro d'affaire
    determineCourtFromCaseNumber(caseNumber) {
        if (caseNumber.startsWith("C-")) {
            return "CJUE";
        } else if (caseNumber.startsWith("T-")) {
            return "Trib. UE";
        } else if (caseNumber.startsWith("F-")) {
            return "Trib. fonction publique UE";
        }
        return "Cour UE"; // Fallback générique
    }

    // Extraire les liens vers les documents (pour usage futur)
    extractDocumentLinks() {
        const links = {
            judgment: null,
            opinion: null
        };

        try {
            // Chercher tous les liens vers les documents
            const documentLinks = document.querySelectorAll("a[href*='document/document.jsf']");
            
            documentLinks.forEach(link => {
                const href = link.getAttribute("href");
                const row = link.closest("tr");
                
                if (row) {
                    const cellText = row.querySelector(".liste_table_cell_doc");
                    if (cellText) {
                        const text = cellText.textContent.trim();
                        
                        if (text.includes("Arrêt")) {
                            links.judgment = this.makeAbsoluteUrl(href);
                        } else if (text.includes("Conclusions")) {
                            links.opinion = this.makeAbsoluteUrl(href);
                        }
                    }
                }
            });
        } catch (error) {
            this.log("Erreur lors de l'extraction des liens", error);
        }

        return links;
    }

    // Convertir une URL relative en URL absolue
    makeAbsoluteUrl(relativeUrl) {
        if (relativeUrl.startsWith("http")) {
            return relativeUrl;
        }
        return new URL(relativeUrl, window.location.origin).href;
    }

    // Pour l'instant, retourner null car on est sur une page de liste
    // Plus tard, on pourra implémenter l'extraction en suivant les liens
    extractDecisionText() {
        this.log("Extraction du texte de décision non implémentée sur la page de liste");
        return null;
    }

    // Pour l'instant, retourner null car on est sur une page de liste
    extractAnalysis() {
        this.log("Extraction de l'analyse non implémentée sur la page de liste");
        return null;
    }

    // Méthodes spécifiques à Curia

    // Identifier le type de juridiction européenne
    getJurisdictionType() {
        const metadata = this.extractMetadata();
        if (!metadata || !metadata.caseNumber) return "europeen";
        
        if (metadata.caseNumber.startsWith("C-")) return "cjue";
        if (metadata.caseNumber.startsWith("T-")) return "tribunal_ue";
        if (metadata.caseNumber.startsWith("F-")) return "tribunal_fonction_publique";
        
        return "europeen";
    }

    // Extraire les numéros d'affaires jointes s'il y en a
    extractJoinedCases() {
        const metadata = this.extractMetadata();
        if (!metadata || !metadata.fullTitle) return [];
        
        // Chercher des patterns comme "C-278/22, C-279/22"
        const joinedPattern = /([CTF]-\d+\/\d+)/g;
        const matches = metadata.fullTitle.match(joinedPattern);
        
        return matches && matches.length > 1 ? matches : [];
    }

    // Valider que les données essentielles sont présentes pour Curia
    validateExtraction() {
        const metadata = this.extractMetadata();
        if (!metadata) {
            return {
                isValid: false,
                missingFields: ["metadata"]
            };
        }

        const required = ["caseNumber", "caseName", "date", "court"];
        const missing = required.filter(field => !metadata[field]);
        
        return {
            isValid: missing.length === 0,
            missingFields: missing
        };
    }
};