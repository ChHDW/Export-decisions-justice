// Extracteur spécifique pour Légifrance - MISE À JOUR extraction texte HTML
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
            
            // Date de lecture - FORMAT DD/MM/YYYY
            const dateElement = document.querySelector(".frame-block.print-sommaire .h2.title.horsAbstract");
            if (dateElement) {
                const dateInfo = this.parseLegifranceDate(dateElement.textContent);
                if (dateInfo) {
                    metadata.date = dateInfo.formatted; // Format DD/MM/YYYY
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

    // Parser spécifique pour Légifrance avec format DD/MM/YYYY
    parseLegifranceDate(dateText) {
        if (!dateText) return null;
        
        try {
            // Pattern pour dates françaises : "14 septembre 2023" ou similaire
            const frenchDatePattern = /(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i;
            const match = dateText.match(frenchDatePattern);
            
            if (match) {
                const day = match[1].padStart(2, '0');
                const monthName = match[2].toLowerCase();
                const year = match[3];
                
                // Conversion mois français vers numéro
                const monthMap = {
                    'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04',
                    'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08',
                    'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12'
                };
                
                const month = monthMap[monthName];
                if (month) {
                    return {
                        original: match[0],
                        formatted: `${day}/${month}/${year}`, // FORMAT DD/MM/YYYY
                        year: year
                    };
                }
            }
            
            // Fallback : si déjà au format DD/MM/YYYY
            const directPattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
            const directMatch = dateText.match(directPattern);
            if (directMatch) {
                const day = directMatch[1].padStart(2, '0');
                const month = directMatch[2].padStart(2, '0');
                const year = directMatch[3];
                
                return {
                    original: directMatch[0],
                    formatted: `${day}/${month}/${year}`,
                    year: year
                };
            }
            
            this.log("Format de date non reconnu", dateText);
            return null;
            
        } catch (error) {
            this.log("Erreur lors du parsing de date", error);
            return null;
        }
    }

    // MÉTHODE MODIFIÉE : Extraire le texte de la décision en conservant la mise en forme HTML
    extractDecisionText() {
        try {
            const contentPage = document.querySelector(".content-page");
            if (!contentPage) {
                this.log("Element .content-page non trouvé");
                return null;
            }
            
            // Cloner pour ne pas modifier l'original
            const clone = contentPage.cloneNode(true);
            
            // Supprimer le titre h2.title
            const titleH2 = clone.querySelector("h2.title");
            if (titleH2) titleH2.remove();
            
            // NOUVEAU : Conserver la mise en forme HTML et la convertir en texte structuré
            const formattedText = this._convertHtmlToFormattedText(clone);
            
            this.log("Texte de décision extrait avec mise en forme HTML", { 
                longueur: formattedText?.length 
            });
            
            return formattedText;
            
        } catch (error) {
            this.log("Erreur lors de l'extraction du texte", error);
            return null;
        }
    }

    // NOUVELLE MÉTHODE : Convertir le HTML en texte formaté en conservant la structure
    _convertHtmlToFormattedText(element) {
        if (!element) return null;

        try {
            // Cloner pour ne pas modifier l'original
            const clone = element.cloneNode(true);
            
            // Supprimer les éléments indésirables
            clone.querySelectorAll("script, style, noscript").forEach(el => el.remove());
            
            // Convertir les balises HTML en équivalents texte
            this._processHtmlElements(clone);
            
            // Récupérer le texte et nettoyer
            let text = clone.textContent || clone.innerText || "";
            
            // Nettoyer les sauts de ligne excessifs
            text = text.replace(/\n{3,}/g, "\n\n"); // Maximum 2 sauts de ligne consécutifs
            text = text.replace(/[ \t]+/g, " "); // Normaliser les espaces
            text = text.trim();
            
            return text;
            
        } catch (error) {
            this.log("Erreur lors de la conversion HTML vers texte", error);
            return null;
        }
    }

    // NOUVELLE MÉTHODE : Traiter les éléments HTML pour préserver la structure
    _processHtmlElements(element) {
        // Traitement des éléments dans l'ordre de priorité
        
        // 1. Traiter les sauts de ligne <br>
        element.querySelectorAll("br").forEach(br => {
            br.replaceWith("\n");
        });
        
        // 2. Traiter les paragraphes <p>
        element.querySelectorAll("p").forEach(p => {
            // Ajouter des sauts de ligne avant et après chaque paragraphe
            p.insertAdjacentText('beforebegin', '\n\n');
            p.insertAdjacentText('afterend', '\n\n');
        });
        
        // 3. Traiter les titres (h1, h2, h3, h4, h5, h6)
        element.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(heading => {
            // Ajouter des sauts de ligne avant et après les titres
            heading.insertAdjacentText('beforebegin', '\n\n');
            heading.insertAdjacentText('afterend', '\n\n');
        });
        
        // 4. Traiter les divs structurels
        element.querySelectorAll("div").forEach(div => {
            // Ajouter un saut de ligne après chaque div pour séparer les sections
            div.insertAdjacentText('afterend', '\n');
        });
        
        // 5. Traiter les listes (ul, ol)
        element.querySelectorAll("ul, ol").forEach(list => {
            list.insertAdjacentText('beforebegin', '\n');
            list.insertAdjacentText('afterend', '\n');
        });
        
        // 6. Traiter les éléments de liste (li)
        element.querySelectorAll("li").forEach(li => {
            li.insertAdjacentText('beforebegin', '\n- ');
            li.insertAdjacentText('afterend', '');
        });
        
        // 7. Traiter les tableaux
        element.querySelectorAll("table").forEach(table => {
            table.insertAdjacentText('beforebegin', '\n\n');
            table.insertAdjacentText('afterend', '\n\n');
        });
        
        // 8. Traiter les cellules de tableau (td, th)
        element.querySelectorAll("td, th").forEach(cell => {
            cell.insertAdjacentText('afterend', ' | ');
        });
        
        // 9. Traiter les lignes de tableau (tr)
        element.querySelectorAll("tr").forEach(row => {
            row.insertAdjacentText('afterend', '\n');
        });
        
        // 10. Traiter les autres éléments de structure
        element.querySelectorAll("section, article, header, footer, aside").forEach(structural => {
            structural.insertAdjacentText('beforebegin', '\n\n');
            structural.insertAdjacentText('afterend', '\n\n');
        });
        
        // 11. Traiter les éléments inline qui nécessitent de l'espace
        element.querySelectorAll("strong, b, em, i").forEach(inline => {
            // Les laisser tels quels, ils sont déjà bien intégrés dans le texte
        });
        
        // 12. Traiter les liens (garder le texte, ignorer l'URL)
        element.querySelectorAll("a").forEach(link => {
            // Garder juste le texte du lien
            link.replaceWith(link.textContent);
        });
    }

    // Surcharger la méthode de formatage pour Légifrance (utilisation de la structure HTML)
    formatDecisionText(rawText) {
        if (!rawText) return null;
        
        // Pour Légifrance, le texte est déjà bien formaté par _convertHtmlToFormattedText
        // On fait juste un nettoyage léger supplémentaire
        
        let text = rawText;
        
        // Améliorer certains patterns spécifiques à la jurisprudence
        text = text.replace(/Considérant/g, "\n\nConsidérant"); // Séparer les considérants
        text = text.replace(/DECIDE|DÉCIDE/g, "\n\n$&"); // Séparer les décisions
        text = text.replace(/PAR CES MOTIFS/g, "\n\n$&"); // Séparer les motifs
        text = text.replace(/Article \d+/g, "\n\n$&"); // Séparer les articles
        
        // Nettoyage final
        text = text.replace(/\n{3,}/g, "\n\n"); // Maximum 2 sauts de ligne
        text = text.replace(/[ \t]+/g, " "); // Normaliser les espaces
        text = text.trim();
        
        return text;
    }

    // Extraire l'analyse (abstrats et résumé) - INCHANGÉE
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

    // Méthodes spécifiques à Légifrance - INCHANGÉES

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