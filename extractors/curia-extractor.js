// Extracteur spécifique pour Curia (CJUE) - Version avec extraction de texte
window.CuriaExtractor = class extends window.BaseExtractor {
    
    constructor() {
        super("Curia");
        this.isCompatible = this.checkCompatibility();
        this.documentCache = new Map(); // Cache pour éviter les requêtes multiples
    }

    // Vérifier si on est sur une page Curia ou EUR-Lex compatible
    checkCompatibility() {
        const url = window.location.href;
        
        // EUR-Lex : pages de jurisprudence CJUE
        const isEurLex = url.includes("eur-lex.europa.eu") && 
                        (url.includes("CELEX:") && 
                         (url.includes("CJ") || url.includes("CC"))) && 
                        document.querySelector("#text") !== null;
        
        // Curia : pages de liste
        const isCuria = url.includes("curia.europa.eu");
        const isListePage = url.includes("/liste.jsf") || url.includes("/document/document.jsf");
        const hasCase = document.querySelector(".affaire_title") !== null ||
                       document.querySelector(".outputEcliAff") !== null;
        
        const compatible = isEurLex || (isCuria && isListePage && hasCase);
        this.log("Vérification de compatibilité", { url, compatible, isEurLex, isCuria: isCuria && hasCase });
        
        return compatible;
    }

    // Extraire les métadonnées spécifiques à Curia/EUR-Lex
    extractMetadata() {
        const metadata = {
            site: this.siteName,
            url: this.getCurrentUrl()
        };
        
        try {
            // Détecter le type de page
            const isEurLex = this.getCurrentUrl().includes("eur-lex.europa.eu");
            
            if (isEurLex) {
                // Extraction depuis EUR-Lex
                return this.extractEurLexMetadata(metadata);
            } else {
                // Extraction depuis Curia (page de liste)
                return this.extractCuriaListMetadata(metadata);
            }
            
        } catch (error) {
            this.log("Erreur lors de l'extraction des métadonnées", error);
            return null;
        }
    }

    // Extraire métadonnées depuis EUR-Lex
    extractEurLexMetadata(metadata) {
        // Titre principal contenant toutes les informations
        const titleElement = document.querySelector("#title, p.title-bold");
        if (titleElement) {
            const fullTitle = titleElement.textContent.trim();
            metadata.fullTitle = fullTitle;
            
            // Extraire le numéro d'affaire depuis le titre
            const caseNumberMatch = fullTitle.match(/Affaire\s+(C-\d+\/\d+)/i);
            if (caseNumberMatch) {
                metadata.caseNumber = caseNumberMatch[1];
                metadata.number = `aff. ${metadata.caseNumber}`;
            }
            
            // Extraire la date depuis le titre  
            const dateMatch = fullTitle.match(/(\d{1,2}\s+\w+\s+\d{4})/);
            if (dateMatch) {
                metadata.date = dateMatch[1];
                const yearMatch = dateMatch[1].match(/(\d{4})/);
                if (yearMatch) {
                    metadata.year = yearMatch[1];
                }
            }
            
            // Extraire les parties depuis le titre
            const partiesMatch = fullTitle.match(/^[^\\n]*?\.\s*([^\\n]+?)\s+contre\s+([^\\n]+?)\./);
            if (partiesMatch) {
                metadata.caseName = `${partiesMatch[1].trim()} c. ${partiesMatch[2].trim()}`;
            }
        }

        // Extraire l'ECLI
        const textContent = document.body.textContent;
        const ecliMatch = textContent.match(/ECLI:EU:C:\d{4}:\d+/);
        if (ecliMatch) {
            metadata.ecli = ecliMatch[0];
        }

        // Extraire le type de document depuis l'URL ou le titre
        if (metadata.fullTitle && metadata.fullTitle.includes("Arrêt")) {
            metadata.documentType = "Arrêt";
        }

        // Déterminer la juridiction
        if (metadata.caseNumber) {
            metadata.court = this.determineCourtFromCaseNumber(metadata.caseNumber);
        }

        // URL EUR-Lex : utiliser l'URL actuelle car on est déjà sur EUR-Lex
        metadata.url = this.getCurrentUrl();

        this.log("Métadonnées EUR-Lex extraites", metadata);
        return metadata;
    }

    // Extraire métadonnées depuis la page de liste Curia (méthode originale)
    extractCuriaListMetadata(metadata) {
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

        // Construire l'URL EUR-Lex à partir du numéro d'affaire et de l'année
        if (metadata.caseNumber && metadata.year) {
            metadata.url = this.buildEurLexUrl(metadata.caseNumber, metadata.year);
        } else {
            // Fallback vers l'URL actuelle
            metadata.url = this.getCurrentUrl();
        }

        // Extraire les liens vers les documents
        metadata.documentLinks = this.extractDocumentLinks();

        this.log("Métadonnées Curia extraites", metadata);
        return metadata;
    }

    // Construire l'URL EUR-Lex à partir du numéro d'affaire et de l'année
    buildEurLexUrl(caseNumber, year) {
        // Format EUR-Lex : CELEX:62022CJ0278 pour C-278/22 de 2022
        // Extraire le numéro de l'affaire (ex: 278 depuis C-278/22)
        const numberMatch = caseNumber.match(/C-(\d+)\/(\d{2})/);
        if (!numberMatch) {
            this.log("Impossible de parser le numéro d'affaire pour EUR-Lex", caseNumber);
            return this.getCurrentUrl();
        }

        const caseNum = numberMatch[1].padStart(4, '0'); // 278 -> 0278
        const yearShort = numberMatch[2]; // 22
        const yearFull = year; // 2023 (année de la décision)
        
        // Construire le CELEX : 6 + année_courte + CJ + numéro
        const celex = `6${yearShort}CJ${caseNum}`;
        
        // URL EUR-Lex français
        return `https://eur-lex.europa.eu/legal-content/fr/TXT/?uri=CELEX:${celex}`;
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
            opinion: null,
            judgmentDocId: null,
            opinionDocId: null
        };

        try {
            // Chercher tous les liens vers les documents dans le tableau
            const documentRows = document.querySelectorAll(".table_document_ligne");
            
            documentRows.forEach(row => {
                const cellDoc = row.querySelector(".liste_table_cell_doc");
                const linkElement = row.querySelector(".liste_table_cell_links_curia a");
                
                if (cellDoc && linkElement) {
                    const cellText = cellDoc.textContent.trim();
                    const href = linkElement.getAttribute("href");
                    
                    // Extraire le docid de l'URL
                    const docIdMatch = href.match(/docid=(\d+)/);
                    const docId = docIdMatch ? docIdMatch[1] : null;
                    
                    if (cellText.includes("Arrêt")) {
                        links.judgment = this.makeAbsoluteUrl(href);
                        links.judgmentDocId = docId;
                    } else if (cellText.includes("Conclusions")) {
                        links.opinion = this.makeAbsoluteUrl(href);
                        links.opinionDocId = docId;
                    }
                }
            });

            this.log("Liens extraits", links);
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

    // 🆕 NOUVELLE MÉTHODE : Extraire le texte de la décision depuis EUR-Lex ou via webscraping
    async extractDecisionText() {
        const url = this.getCurrentUrl();
        
        // Si on est déjà sur EUR-Lex avec le texte, extraire directement
        if (url.includes("eur-lex.europa.eu")) {
            return this.extractEurLexDecisionText();
        }
        
        // Sinon, utiliser la méthode webscraping originale pour Curia
        return this.extractDecisionTextViaWebscraping();
    }

    // Extraire le texte directement depuis EUR-Lex avec le xpath spécifique
    extractEurLexDecisionText() {
        try {
            // Utiliser le xpath spécifique demandé
            const xpath = '/html/body/div[5]/div/div[3]/div/div[2]/div[2]/div/div/div[4]';
            const contentElement = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            
            if (!contentElement) {
                this.log("Élément de contenu principal non trouvé avec le xpath spécifique");
                // Fallback vers les sélecteurs CSS
                const fallbackElement = document.querySelector("#text .panel-body #document1, #textTabContent #document1");
                if (!fallbackElement) {
                    this.log("Aucun élément de contenu trouvé");
                    return null;
                }
                return this.extractAndFormatText(fallbackElement);
            }

            return this.extractAndFormatText(contentElement);
            
        } catch (error) {
            this.log("Erreur lors de l'extraction directe EUR-Lex", error);
            return null;
        }
    }

    // Extraire et formater le texte pour conserver la structure EUR-Lex
    extractAndFormatText(element) {
        // Cloner l'élément pour le nettoyer sans affecter la page
        const clone = element.cloneNode(true);
        
        // Supprimer les éléments indésirables mais conserver la structure
        clone.querySelectorAll("script, style, .PageTools, .btn, button, nav, header, footer, .sr-only").forEach(el => el.remove());
        
        // Traiter les éléments de structure pour maintenir la mise en forme
        let formattedText = this.processEurLexStructure(clone);
        
        this.log("Texte d'arrêt extrait et formaté depuis EUR-Lex", { longueur: formattedText?.length });
        return formattedText;
    }

    // Traiter la structure EUR-Lex pour maintenir la mise en forme
    processEurLexStructure(element) {
        // Traiter les titres et paragraphes spécifiques à EUR-Lex
        const titleElements = element.querySelectorAll('.coj-sum-title-1, .coj-title-grseq-2, .coj-title-grseq-3');
        titleElements.forEach(title => {
            const text = title.textContent.trim();
            if (text) {
                title.textContent = `\n\n${text.toUpperCase()}\n`;
            }
        });

        // Traiter les paragraphes de contenu
        const paragraphs = element.querySelectorAll('.coj-normal, .coj-pnormal');
        paragraphs.forEach(p => {
            const text = p.textContent.trim();
            if (text) {
                p.textContent = `\n${text}\n`;
            }
        });

        // Traiter les points numérotés
        const points = element.querySelectorAll('.coj-count');
        points.forEach(point => {
            const text = point.textContent.trim();
            if (text && text.match(/^\d+$/)) {
                point.textContent = `\n${text}. `;
            }
        });

        // Traiter les tableaux (pour les listes à puces)
        const tables = element.querySelectorAll('table');
        tables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                    const bullet = cells[0].textContent.trim();
                    const content = cells[1].textContent.trim();
                    if (bullet === '–' || bullet === '-') {
                        row.textContent = `\n– ${content}`;
                    } else {
                        row.textContent = `\n${content}`;
                    }
                }
            });
        });

        // Extraire le texte final
        let text = element.textContent || element.innerText || "";
        
        // Nettoyer et normaliser les espaces
        text = text.replace(/\n\s*\n\s*\n+/g, '\n\n'); // Réduire les multiples sauts de ligne
        text = text.replace(/[ \t]+/g, ' '); // Normaliser les espaces
        text = text.replace(/^\s+|\s+$/g, ''); // Supprimer les espaces en début/fin
        
        return text;
    }

    // Méthode webscraping pour Curia (ancienne méthode)
    async extractDecisionTextViaWebscraping() {
        const metadata = this.extractMetadata();
        if (!metadata || !metadata.documentLinks) {
            this.log("Pas de métadonnées ou liens disponibles");
            return null;
        }

        const judgmentUrl = metadata.documentLinks.judgment;
        if (!judgmentUrl) {
            this.log("Pas de lien vers l'arrêt trouvé");
            return null;
        }

        try {
            // Vérifier le cache d'abord
            if (this.documentCache.has(judgmentUrl)) {
                this.log("Texte d'arrêt récupéré depuis le cache");
                return this.documentCache.get(judgmentUrl);
            }

            this.log("Récupération du texte d'arrêt depuis", judgmentUrl);
            
            // Récupérer le contenu HTML
            const response = await fetch(judgmentUrl, {
                method: 'GET',
                credentials: 'same-origin', // Inclure les cookies de session
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'User-Agent': navigator.userAgent
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            const text = this.parseDecisionTextFromHTML(html);
            
            // Mettre en cache
            this.documentCache.set(judgmentUrl, text);
            
            this.log("Texte d'arrêt extrait avec succès via webscraping", { longueur: text?.length });
            return text;

        } catch (error) {
            this.log("Erreur lors du webscraping", error);
            return null;
        }
    }

    // 🆕 NOUVELLE MÉTHODE : Extraire l'analyse depuis EUR-Lex ou via webscraping
    async extractAnalysis() {
        const url = this.getCurrentUrl();
        
        // Si on est sur EUR-Lex, chercher le résumé/mots-clés dans les onglets
        if (url.includes("eur-lex.europa.eu")) {
            return this.extractEurLexAnalysis();
        }
        
        // Sinon, utiliser la méthode webscraping pour Curia
        return this.extractAnalysisViaWebscraping();
    }

    // Extraire l'analyse depuis EUR-Lex (résumé/mots-clés)
    extractEurLexAnalysis() {
        try {
            // Sur EUR-Lex, l'analyse peut être dans l'onglet "Summary / Keywords"
            // Pour l'instant, retourner null car cette fonctionnalité nécessiterait
            // de naviguer vers un autre onglet ou URL
            this.log("Extraction d'analyse depuis EUR-Lex non implémentée");
            return null;
            
        } catch (error) {
            this.log("Erreur lors de l'extraction d'analyse EUR-Lex", error);
            return null;
        }
    }

    // Méthode webscraping pour Curia (ancienne méthode)
    async extractAnalysisViaWebscraping() {
        const metadata = this.extractMetadata();
        if (!metadata || !metadata.documentLinks) {
            this.log("Pas de métadonnées ou liens disponibles");
            return null;
        }

        const opinionUrl = metadata.documentLinks.opinion;
        if (!opinionUrl) {
            this.log("Pas de lien vers les conclusions trouvé");
            return null;
        }

        try {
            // Vérifier le cache d'abord
            if (this.documentCache.has(opinionUrl)) {
                this.log("Texte de conclusions récupéré depuis le cache");
                return this.documentCache.get(opinionUrl);
            }

            this.log("Récupération du texte de conclusions depuis", opinionUrl);
            
            // Récupérer le contenu HTML
            const response = await fetch(opinionUrl, {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'User-Agent': navigator.userAgent
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            const text = this.parseDecisionTextFromHTML(html);
            
            // Mettre en cache
            this.documentCache.set(opinionUrl, text);
            
            this.log("Texte de conclusions extrait avec succès", { longueur: text?.length });
            return text;

        } catch (error) {
            this.log("Erreur lors de l'extraction du texte de conclusions", error);
            return null;
        }
    }

    // 🆕 NOUVELLE MÉTHODE : Parser le HTML de la page de document Curia
    parseDecisionTextFromHTML(html) {
        try {
            // Créer un parser DOM temporaire
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Les sélecteurs typiques pour le contenu des documents Curia
            // (À ajuster selon la structure réelle des pages de documents)
            const possibleSelectors = [
                '.document-content',     // Sélecteur hypothétique principal
                '.texte-integral',       // Sélecteur hypothétique 
                '#documentText',         // Sélecteur hypothétique
                '.decision-content',     // Sélecteur hypothétique
                'body',                  // Fallback - tout le body
            ];

            let contentElement = null;
            
            // Essayer chaque sélecteur jusqu'à trouver du contenu
            for (const selector of possibleSelectors) {
                contentElement = doc.querySelector(selector);
                if (contentElement && contentElement.textContent.trim().length > 100) {
                    break;
                }
            }

            if (!contentElement) {
                this.log("Aucun contenu trouvé avec les sélecteurs");
                return null;
            }

            // Nettoyer et extraire le texte
            const clone = contentElement.cloneNode(true);
            
            // Supprimer les éléments indésirables
            clone.querySelectorAll("script, style, nav, header, footer, .navigation, .menu").forEach(el => el.remove());
            
            let text = window.DOMHelpers.extractTextFromElement(clone);
            
            // Nettoyage spécifique pour Curia
            text = this.cleanCuriaText(text);
            
            return text;

        } catch (error) {
            this.log("Erreur lors du parsing HTML", error);
            return null;
        }
    }

    // 🆕 NOUVELLE MÉTHODE : Nettoyage spécifique du texte Curia/EUR-Lex
    cleanCuriaText(text) {
        if (!text) return null;

        // Supprimer les éléments de navigation typiques de Curia
        text = text.replace(/InfoCuria.*?Jurisprudence/g, '');
        text = text.replace(/Accueil\s*>\s*.*?>\s*/g, '');
        text = text.replace(/Lancer l'impression/g, '');
        text = text.replace(/Version.*?PDF/g, '');
        
        // Supprimer les éléments spécifiques à EUR-Lex
        text = text.replace(/EUR-Lex.*?Access to European Union law/g, '');
        text = text.replace(/Document\s+\d+CJ\d+/g, '');
        text = text.replace(/Expand all.*?Collapse all/g, '');
        text = text.replace(/Languages and formats available/g, '');
        text = text.replace(/Multilingual display/g, '');
        text = text.replace(/Text/g, '');
        
        // Supprimer les répétitions d'ECLI
        text = text.replace(/ECLI:EU:C:\d{4}:\d+/g, '');
        
        // Supprimer les numéros de pages et références de pagination
        text = text.replace(/\d+\/\d+/g, '');
        
        // Nettoyer les caractères spéciaux et espacements
        text = text.replace(/\u00A0/g, ' '); // Espaces insécables
        text = text.replace(/\s+/g, ' '); // Espaces multiples
        
        // Normaliser les espaces et paragraphes
        text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
        text = text.replace(/[ \t]+/g, ' ');
        
        return window.DOMHelpers.cleanText(text);
    }

    // 🆕 MÉTHODE MISE À JOUR : Générer un RIS complet avec textes extraits
    async generateCompleteRIS() {
        const metadata = this.extractMetadata();
        if (!metadata) return null;

        // Extraire seulement le texte de la décision
        const decisionText = await this.extractDecisionText();

        const content = {
            decisionText: this.formatDecisionText(decisionText),
            analysisText: null, // Pas d'analyse pour l'instant
            additionalNotes: [] // Pas de notes additionnelles
        };

        return window.RISGenerator.generateComplete(metadata, content);
    }

    // Formater le texte de décision pour les arrêts CJUE
    formatDecisionText(rawText) {
        if (!rawText) return null;

        let text = rawText;
        
        // Préserver les titres importants des arrêts CJUE
        text = text.replace(/ARRÊT DE LA COUR/g, "\n\nARRÊT DE LA COUR");
        text = text.replace(/ORDONNANCE DE LA COUR/g, "\n\nORDONNANCE DE LA COUR");
        
        // Préserver la structure des considérants
        text = text.replace(/considérant/gi, "\nconsidérant");
        
        // Préserver la structure des points numérotés
        text = text.replace(/(\d+)\s+/g, "\n\n$1\t");
        
        // Préserver les énumérations avec tirets
        text = text.replace(/–\s+/g, "\n–\t");
        
        // Améliorer la structure des paragraphes juridiques
        text = text.replace(/:\s*\n/g, ":\n\n");
        text = text.replace(/;\s*\n/g, ";\n\n");
        
        // Préserver les citations d'articles
        //text = text.replace(/Article\s+\d+/g, "\n");  

    // Identifier le type de juridiction européenne");
        //text = text.replace(/L'article\s+\d+/g, "\n");    

    // Identifier le type de juridiction européenne");
        
        // Préserver les motifs de décision
        text = text.replace(/PAR CES MOTIFS/g, "\n\nPAR CES MOTIFS");
        text = text.replace(/DECIDE|DÉCIDE/g, "\n\n");

    // Identifier le type de juridiction européenne");
        
        // Préserver les signatures
        text = text.replace(/Signatures?/g, "\n\n");   

    // Identifier le type de juridiction européenne");
        
        // Nettoyer les espaces multiples mais préserver la structure
        text = text.replace(/\n\n\n+/g, '\n\n');
        text = text.replace(/[ \t]+/g, ' ');
        text = text.trim();
        
        return text;
    }
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

    // Valider que les données essentielles sont présentes pour Curia/EUR-Lex
    validateExtraction() {
        const metadata = this.extractMetadata();
        if (!metadata) {
            return {
                isValid: false,
                missingFields: ["metadata"]
            };
        }

        const required = ["caseNumber", "date", "court"];
        const missing = required.filter(field => !metadata[field]);
        
        return {
            isValid: missing.length === 0,
            missingFields: missing
        };
    }

    // 🆕 NOUVELLE MÉTHODE : Nettoyer le cache (utile pour le debugging)
    clearCache() {
        this.documentCache.clear();
        this.log("Cache des documents nettoyé");
    }

    // 🆕 NOUVELLE MÉTHODE : Obtenir des statistiques sur le cache
    getCacheStats() {
        return {
            size: this.documentCache.size,
            keys: Array.from(this.documentCache.keys())
        };
    }
};