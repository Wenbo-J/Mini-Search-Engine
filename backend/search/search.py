#!/usr/bin/env python3
import sys, re, math, string, argparse, json
from collections import defaultdict
import nltk

def usage():
    print(f"usage: {sys.argv[0]} -d dictionary-file -p postings-file -q query-file -o output-file")
    sys.exit(1)
    
def parse_postings_line(line):
    # parse a line like "docGap,tf:pos1,pos2,...:skip", return list of (docID, tf, [positions], skip)
    prev = 0
    out = []
    for tok in line.strip().split():
        parts = tok.split(':')
        gap_tf = parts[0]
        gap, tf = map(int, gap_tf.split(','))
        docID = prev + gap
        prev = docID
        
        # Add positions if available (for phrase queries)
        positions = []
        if len(parts) > 1 and parts[1]:
            prev_pos = 0
            for pg in parts[1].split(','):
                pos = prev_pos + int(pg)
                positions.append(pos)
                prev_pos = pos
                
        # Add skip pointer if available (for boolean operations)
        skip = int(parts[2]) if len(parts) > 2 and parts[2] != '' else -1
        
        out.append((docID, tf, positions, skip))
    return out
    
def parse_lengths_line(items):
    L = {}
    for p in items:
        doc, length = p.split(':')
        L[int(doc)] = float(length)
    return L
    
def get_postings(zone_key, dictionary, postings_fh):
    # get postings for a zone_key (like 'phone@title' etc), from dict[term] by offset
    if zone_key not in dictionary:
        return []
    df, offset = dictionary[zone_key]
    postings_fh.seek(offset)
    return parse_postings_line(postings_fh.readline())
    
def get_postings_all(base, dictionary, postings_fh, base2zones):
    # merge all zone_key postings for a base term

    merged = []
    for zk in base2zones.get(base, []):
        merged.extend(get_postings(zk, dictionary, postings_fh))
    return merged

def shunting_yard(query_tokens):
    # convert infix query → postfix (shunting yard pretty much the same code from previous HW2)
    precedence = {'not': 3, 'and': 2, 'or': 1}
    associativity = {'not': 'R', 'and': 'L', 'or': 'L'}
    output = []
    operators = []

    for token in query_tokens:
        if token in precedence:  # if token is an operator
            while (operators and operators[-1] != '(' and 
                   (precedence[operators[-1]] > precedence[token] or 
                   (precedence[operators[-1]] == precedence[token] and associativity[token] == 'L'))):
                output.append(operators.pop())
            operators.append(token)
        else:  # if token is a term
            output.append(token)

    while operators:
        output.append(operators.pop())

    return output

def intersect_with_skips(p1, p2):
    # intersect two postings lists using skip pointers for efficiency
    result = []
    i, j = 0, 0
    
    while i < len(p1) and j < len(p2):
        doc1, skip1 = p1[i]
        doc2, skip2 = p2[j]
        
        if doc1 == doc2:
            result.append(doc1)
            i += 1
            j += 1
        elif doc1 < doc2:
            if skip1 != -1 and i + skip1 < len(p1) and p1[skip1][0] <= doc2:
                i = skip1
            else:
                i += 1
        else:  # doc2 < doc1
            if skip2 != -1 and j + skip2 < len(p2) and p2[skip2][0] <= doc1:
                j = skip2
            else:
                j += 1
                
    return result

def process_phrase_query(words, dictionary, postings_fh, base2zones):
    # using the positional indices to process phrase query
    # for each word, collect all postings across zones
    word_postings = []
    for word in words:
        zones = base2zones.get(word, [])
        if not zones:
            return []  # word not in dictionary, phrase cannot exist
        
        # collect all postings for curr word
        term_postings = []
        for zone in zones:
            term_postings.extend(get_postings(zone, dictionary, postings_fh))
        
        if not term_postings:
            return []  # no postings for this word, phrase cannot exist
            
        word_postings.append(term_postings)
    
    # if we don't have all words, phrase can't exist
    if len(word_postings) != len(words):
        return []
        
    # build position map for the first word
    candidates = {}  # {docID: [positions]}
    for doc, _, positions, _ in word_postings[0]:
        if positions:  # Only consider docs with position info
            candidates[doc] = positions
    
    # For each subsequent word, check if it appears in the right position
    for i, term_postings in enumerate(word_postings[1:], 1):
        # Build position map for current word
        curr_positions = defaultdict(list)
        for doc, _, positions, _ in term_postings:
            if positions:
                curr_positions[doc] = positions
        
        # update candidates, only keep docs where words appear consecutively
        new_candidates = {}
        for doc, positions in candidates.items():
            if doc not in curr_positions:
                continue
                
            # Check for consecutive positions
            next_positions = []
            for pos in positions:
                if pos + 1 in curr_positions[doc]:
                    next_positions.append(pos + 1)
                    
            if next_positions:
                new_candidates[doc] = next_positions
                
        candidates = new_candidates
        if not candidates:
            return []  # no more candidates, phrase cannot exist
    
    # convert to format used by boolean operations
    return [(doc, -1) for doc in candidates.keys()]

def evaluate_boolean_query(query_tokens, dictionary, postings_fh, base2zones):
    # use shunting yard to evaluate bool query
    tokens = shunting_yard(query_tokens)
    stack = []

    for token in tokens:
        if token == 'and':
            # use intersect with skip pointers
            if len(stack) < 2:
                stack.append([])  # not enough operands
                continue
                
            right = stack.pop()
            left = stack.pop()
            
            # check if either list is empty
            if not left or not right:
                stack.append([])
                continue
                
            # handle different formats of postings list entries
            p1 = []
            for entry in left:
                if isinstance(entry, tuple):
                    if len(entry) >= 4:
                        p1.append((entry[0], entry[3]))  # (docID, skip)
                    elif len(entry) >= 2:
                        p1.append((entry[0], entry[1]))  # Assume (docID, skip)
                    else:
                        p1.append((entry[0], -1))
                else:
                    p1.append((entry, -1))  # Just a docID
            
            p2 = []
            for entry in right:
                if isinstance(entry, tuple):
                    if len(entry) >= 4:
                        p2.append((entry[0], entry[3]))
                    elif len(entry) >= 2:
                        p2.append((entry[0], entry[1]))
                    else:
                        p2.append((entry[0], -1))
                else:
                    p2.append((entry, -1))
            
            commons = intersect_with_skips(p1, p2)
            stack.append([(d, -1) for d in commons])
        else:
            # Current token is a term or phrase
            if '_' in token:
                # handle phrase query
                words = token.split('_')
                phrase_results = process_phrase_query(words, dictionary, postings_fh, base2zones)
                stack.append(phrase_results)
            else:
                # Single word
                p = get_postings_all(token, dictionary, postings_fh, base2zones)
                stack.append([(d, skip) for d, _, _, skip in p])

    # return document IDs from final stack entry
    result_postings = stack.pop() if stack else []
    return [d for d, _ in result_postings]

def merge_boolean_and_free(boolean_ids, free_ids, B=500, T=500):
    # EXPERIMENT: "Fallback" to free-text if boolean retrieves NONE or TOO LITTLE docs, but keep the boolean essence on top (merging the two)
    # basically if boolean not enough, fill with top free-text docs (no dupes)

    top_bool = boolean_ids[:B]
    
    # if we have enough boolean results, just return those
    if len(top_bool) >= T:
        return top_bool

    # Otherwise, fill in with free-text results (avoiding duplicates)
    merged = list(top_bool)
    seen = set(merged)
    
    for d in free_ids:
        if d not in seen:
            merged.append(d)
            seen.add(d)
            if len(merged) >= T:
                break
                
    return merged

def calculate_date_boost(doc_date):
    # EXPERIMENT: Boost newer docs more. Format: "YYYY-MM-DD HH:MM:SS"
    try:
        # parse date - extract just the date part (ignore time - not useful)
        date_part = doc_date.split(' ')[0]
        year, month, day = map(int, date_part.split('-'))
        
        # base boost starts at 1.0
        boost = 1.0
        
        # Boost based on recency - more recent cases get higher boost
        current_year = 2025  # current year as reference
        years_old = current_year - year
        
        if years_old <= 5:  # super recent (0-5 years old)
            boost = 1.3
        elif years_old <= 10:  # recent (6-10 years old)
            boost = 1.2
        elif years_old <= 20:  # kinda recent (11-20 years old)
            boost = 1.1
        # older documents keep the default 1.0 boost
        
        return boost
    except Exception as e:
        # try except just in case if date parsing fails
        return 1.0

# EXPERIMENT: Trying out NLTK's WordNet to expand query - NOT GOOD EVEN AFTER REFINING, COMMENTED OUT
# def expand_with_wordnet(term, stemmer):
#     # skip expansion for these terms that don't expand well in legal context
#     skip_terms = {'phone', 'call', 'quiet', 'grade', 'scandal'}
#     if term.lower() in skip_terms or len(term) < 4 or term.isdigit():
#         return set()
        
#     # skip numeric IDs
#     if any(c.isdigit() for c in term) and len(term) > 5:
#         return set()
    
#     # legal domain specific filtering
#     legal_domain_terms = {
#         'damage': {'compensation', 'injuri', 'harm', 'loss'},
#         'court': {'tribunal', 'jurisdict', 'legal', 'judici'},
#         'law': {'legisl', 'statut', 'regul', 'legal'},
#         'case': {'action', 'proceed', 'claim', 'suit'},
#         'rule': {'regul', 'order', 'direct', 'guidelin'},
#         'judge': {'justic', 'bench', 'presid', 'adjudic'},
#         'right': {'entitl', 'privileg', 'claim', 'interest'},
#         'evid': {'proof', 'testimonium', 'document', 'exhibit'},
#         'contract': {'agreement', 'oblig', 'undertak', 'arrang'},
#         'liabil': {'respons', 'account', 'oblig', 'debt'}
#     }
    
#     # if the term is in our legal dictionary, return predefined synonyms
#     for legal_term, synonyms in legal_domain_terms.items():
#         if legal_term in term.lower():
#             return synonyms
    
#     # for other terms, use WordNet but with stricter filtering
#     synonyms = set()
#     try:
#         for syn in nltk.corpus.wordnet.synsets(term):
#             # Only consider the most common sense (first synset)
#             if syn.name().split('.')[1] != '01':
#                 continue
                
#             for lemma in syn.lemmas():
#                 w = lemma.name().lower().replace('_', ' ')
#                 # Skip multi-word synonyms as they're less likely to be useful
#                 if ' ' in w:
#                     continue
#                 # Skip synonyms that are too different in length
#                 if abs(len(w) - len(term)) > 3:
#                     continue
#                 synonyms.add(stemmer.stem(w))
#     except:
#         pass
        
#     # remove the original term
#     return synonyms - {term}


def refine_query(initial_results, query_tokens, query_token_freqs, dictionary, postings_fh, N, base2zones):
    # pseudo-relevance feedback on top-k docs, Rocchio

    # using fewer feedback docs now 
    k = 30  # was 50 previously
    feedback_docs = initial_results[:k]
    
    if not feedback_docs:
        return query_tokens, query_token_freqs  # No feedback no results available
        
    # create copies to avoid modifying the originals directly
    expanded_tokens = list(query_tokens)
    expanded_freqs = dict(query_token_freqs)
    
    # build "doc zones" for efficient processing
    # maps docID to list of zone_keys that term appears in
    doc_zones = defaultdict(list)
    for base in expanded_freqs:
        for zk in base2zones.get(base, []):
            for d, _, _, _ in get_postings(zk, dictionary, postings_fh):
                if d in feedback_docs:
                    doc_zones[d].append(zk)
    
    # helper function to build vector for a document
    def doc_vector(doc_id):
        v = defaultdict(float)
        # only consider zone_keys that appear in the top K docs
        for zk in set(z for d in feedback_docs for z in doc_zones.get(d, [])):
            df, _ = dictionary[zk]
            if df == 0:
                continue
            idf = math.log(N/df, 10)
            
            # Search postings just once
            for d, tf, _, _ in get_postings(zk, dictionary, postings_fh):
                if d == doc_id:
                    v[zk] = (1 + math.log(tf, 10)) * idf
                    break
        return v
    
    # Original query vector q0
    q0 = defaultdict(float)
    for term, qf in expanded_freqs.items():
        for zk in base2zones.get(term, []):
            # apply zone weighting directly in the query vector
            zone_weight = 2.0 if '@title' in zk else 1.0
            # EXPERIMENT: to place more emphasis on title
            
            df, _ = dictionary[zk]
            if df == 0:
                continue
            idf = math.log(N/df, 10)
            q0[zk] += (1 + math.log(qf, 10)) * idf * zone_weight
    
    # Rocchio tweak: alpha > beta - trying to keep more original
    alpha, beta = 1.5, 0.4  # Increased alpha, reduced beta
    
    q1 = defaultdict(float)
    
    # keep original q terms × alpha
    for zk, w in q0.items():
        q1[zk] += alpha * w
    
    # add terms from feedback docs * beta
    for d in feedback_docs:
        vd = doc_vector(d)
        for zk, w in vd.items():
            q1[zk] += (beta / len(feedback_docs)) * w
    
    # EXPERIMENT: legal phrasing – add 1-2 synonyms depending on query type

    if any(t.isdigit() for t in query_tokens):
        # Likely case IDs or numeric references, be more conservative
        m = 1  # Just one expansion term
    else:
        # Likely conceptual queries, can expand more
        m = 2  # Two expansion terms
    
    # Sort by score and get top terms
    extra = sorted(q1.items(), key=lambda x: -x[1])[:m]
    
    # EXPERIMENT: Legal domain filtering - only add terms that are likely legal terms
    legal_terms = {
        'court', 'law', 'case', 'judg', 'legal', 'right', 'claim', 'damag',
        'injuri', 'liabil', 'statut', 'contract', 'oblig', 'parti',
        'agreement', 'settl', 'author', 'evid', 'document', 'tort',
        'plaintiff', 'defend', 'appellant', 'respond', 'hear', 'action',
        'proceed', 'suit', 'appeal', 'justic', 'counsel', 'prosecut', 'witness'
    }
    
    # Add selected terms to query
    added_terms = []
    for zk, score in extra:
        base = zk.split('@', 1)[0]
        # Skip terms that are likely noise in legal context
        if any(c.isdigit() for c in base) or len(base) < 3:
            continue
            
        # Only add terms not already in query
        if base not in expanded_freqs:
            # For stronger filtering, can use: if base in legal_terms:
            expanded_freqs[base] = 1
            expanded_tokens.append(base)
            added_terms.append(base)
    
    # print(f"Query refinement added terms: {added_terms}")
    
    return expanded_tokens, expanded_freqs

def score_documents(query_token_freqs, dictionary, postings_fh, N, base2zones):
    # tf-idf score per zone (weight title zone more)
    scores = defaultdict(float)
    
    # Prepare all terms in advance
    terms = list(query_token_freqs.items())
    
    for t, qf in terms:
        zones = base2zones.get(t)
        if not zones:
            continue
            
        # approximate doc-freq by summing zone dfs
        df_sum = sum(dictionary[zk][0] for zk in zones)
        if df_sum == 0:
            continue
            
        idf = math.log(N/df_sum, 10)
        
        # score each zone separately with weighting
        for zone_key in zones:
            # Apply zone weight directly to this zone's contribution
            zone_weight = 2.0 if '@title' in zone_key else 1.0
            # EXPERIMENT: to place more emphasis on title
            
            for docID, tf, _, _ in get_postings(zone_key, dictionary, postings_fh):
                if tf <= 0:
                    continue
                    
                tf_w = 1 + math.log(tf, 10)
                qf_w = 1 + math.log(qf, 10)
                scores[docID] += tf_w * qf_w * idf * zone_weight
    
    return scores

def parse_args():
    p = argparse.ArgumentParser(
        description="Search script (supports JSON output)"
    )
    p.add_argument(
        "--query", "-q",
        help="The query string to search for",
        required=True
    )
    p.add_argument(
        "--topk",
        help="Number of top results to return",
        type=int, default=10
    )
    p.add_argument(
        "--output-format",
        help="text (one-line IDs) or json",
        choices=["text","json"],
        default="text"
    )
    p.add_argument(
        "--dict-file", "-d",
        help="Path to your dictionary file",
        default="dictionary.txt"
    )
    p.add_argument(
        "--postings-file", "-p",
        help="Path to your postings file",
        default="postings.txt"
    )
    p.add_argument(
        "--metadata-file", "-m",
        help="Path to your metadata tsv file",
        default="metadata.tsv"
    )
    return p.parse_args()


def main():
    args = parse_args()
    dfile = args.dict_file
    pfile = args.postings_file
    mfile = args.metadata_file
    query_str = args.query
    topk = args.topk
    out_fmt = args.output_format
        
    print('running search on the query...')
    
    nltk.download('punkt', quiet=True)
    
    # load dictionary and build base:zone_key map
    dictionary = {}
    base2zones = defaultdict(list)
    with open(dfile) as df:
        for L in df:
            term, dfreq, offset = L.split()
            dictionary[term] = (int(dfreq), int(offset))
            base = term.split('@', 1)[0]
            base2zones[base].append(term)
    
    # load metadata if available (for court boosting)
    metadata = {}

    try:
        with open(mfile, "r") as m:
            for line in m:
                parts = line.strip().split('\t')
                if len(parts) >= 3:
                    doc, court, date = parts
                    metadata[int(doc)] = {"court": court, "date": date}

    except:
        print("no metadata file found in curr dir, doublecheck")
    
    # open postings, read header
    postings_fh = open(pfile, 'r')
    hdr = postings_fh.readline().split()
    N = int(hdr[0])
    doc_lengths = parse_lengths_line(hdr[1:])
    
    # read & preprocess query
    raw = query_str  # Only read the first line
    
    # Check if it's a boolean query
    is_boolean = 'AND' in raw
    
    stemmer = nltk.stem.porter.PorterStemmer()
    
    # Process query differently based on type
    if is_boolean:
        # for boolean queries, preserve structure including AND operators and phrases
        parts = re.findall(r'"[^"]+"|\S+', raw)
        query_tokens = []
        query_token_freqs = {}
        
        for tok in parts:
            if tok.upper() == 'AND':
                query_tokens.append('and')
            elif tok.startswith('"') and tok.endswith('"'):
                # Handle quoted phrases
                phrase = tok[1:-1].lower().translate(str.maketrans('', '', string.punctuation))
                terms = nltk.word_tokenize(phrase)
                stems = [stemmer.stem(t) for t in terms]
                query_tokens.append('_'.join(stems))
                
                # Also track individual terms for free-text fallback
                for s in stems:
                    query_token_freqs[s] = query_token_freqs.get(s, 0) + 1
            else:
                w = tok.lower().translate(str.maketrans('', '', string.punctuation))
                if not w:
                    continue
                stem = stemmer.stem(w)
                query_tokens.append(stem)
                query_token_freqs[stem] = query_token_freqs.get(stem, 0) + 1
    else:
        # for free-text queries, simple tokenization
        toks = re.findall(r'\w+', raw.lower())
        query_tokens = [stemmer.stem(t) for t in toks]
        
        # compute query term frequencies
        query_token_freqs = defaultdict(int)
        for t in query_tokens:
            query_token_freqs[t] += 1
    
    # score documents for free-text retrieval
    scores = score_documents(query_token_freqs, dictionary, postings_fh, N, base2zones)
    
    # length normalize & apply the court & date boosts
    for d in list(scores):
        # Length normalization
        L = doc_lengths.get(d, 1.0)
        if L > 0:
            scores[d] /= L
        
        # apply court and date boosts only if metadata file is available
        if metadata and d in metadata:
            # EXPERIMENT: to place more emphasis on courts which prof indicated to have higher level in the hierarchy
            if "court" in metadata[d]:
                court = metadata[d]["court"]
                court_boost = {
                    # Most important
                    "SG Court of Appeal": 1.5,
                    "SG Privy Council": 1.5,
                    "UK House of Lords": 1.5,
                    "UK Supreme Court": 1.5,
                    "High Court of Australia": 1.5,
                    "CA Supreme Court": 1.5,
                    
                    # Important
                    "SG High Court": 1.2,
                    "Singapore International Commercial Court": 1.2,
                    "HK High Court": 1.2,
                    "HK Court of First Instance": 1.2,
                    "UK Crown Court": 1.2,
                    "UK Court of Appeal": 1.2,
                    "UK High Court": 1.2,
                    "Federal Court of Australia": 1.2,
                    "NSW Court of Appeal": 1.2,
                    "NSW Court of Criminal Appeal": 1.2,
                    "NSW Supreme Court": 1.2,
                    
                    # Default
                    "default": 1.0
                }
                court_boost_value = court_boost.get(court, court_boost["default"])
                scores[d] *= court_boost_value
            
            # Date boost
            if "date" in metadata[d]:
                date_boost_value = calculate_date_boost(metadata[d]["date"])
                scores[d] *= date_boost_value
            
    ranked = sorted(scores.items(), key=lambda x: (-x[1], x[0]))
    free_text_results = [d for d, _ in ranked]
    
    # for boolean queries, also evaluate as boolean and merge results
    if is_boolean:
        boolean_results = evaluate_boolean_query(query_tokens, dictionary, postings_fh, base2zones)
        final_results = merge_boolean_and_free(boolean_results, free_text_results)
    else:
        # For free text queries, apply query refinement
        initial_results = free_text_results
        
        # print(f"Original query: {' '.join(query_tokens)}") # for debugging

        # nltk.download('wordnet', quiet=True)
        # nltk.download('omw-1.4', quiet=True)
        # # add WordNet synonyms for query terms
        # wordnet_expanded_tokens = list(query_tokens)
        # wordnet_expanded_freqs = dict(query_token_freqs)
        # wordnet_added = []
        # # Add top 1-2 synonyms for each term
        # for term in query_tokens:
        #     if len(term) < 3:  # skip super short terms
        #         continue
        # synonyms = expand_with_wordnet(term, stemmer)
        # for syn in list(synonyms)[:1]:  # take top 1 synonym
        #     if syn not in wordnet_expanded_freqs and len(syn) > 2:
        #         wordnet_expanded_freqs[syn] = 1
        #         wordnet_expanded_tokens.append(syn)
        #         wordnet_added.append(syn)
        
        # Apply pseudo-relevance feedback
        refined_tokens, refined_freqs = refine_query(
            initial_results, query_tokens, query_token_freqs, 
            dictionary, postings_fh, N, base2zones
        )
        # print(f"Final expanded query: {' '.join(refined_tokens)}") # debug
        
        # re-run scoring with expanded query
        refined_scores = score_documents(refined_freqs, dictionary, postings_fh, N, base2zones)
        
        # length normalize & re-apply boosts
        for d in list(refined_scores):
            # length normalization
            L = doc_lengths.get(d, 1.0)
            if L > 0:
                refined_scores[d] /= L
            
            # apply court and date boosts if metadata available
            if metadata and d in metadata:
                # EXPERIMENT: to place more emphasis on courts which prof indicated to have higher level in the hierarchy

                if "court" in metadata[d]:
                    court = metadata[d]["court"]
                    court_boost = {
                        # Most important
                        "SG Court of Appeal": 1.5,
                        "SG Privy Council": 1.5,
                        "UK House of Lords": 1.5,
                        "UK Supreme Court": 1.5,
                        "High Court of Australia": 1.5,
                        "CA Supreme Court": 1.5,
                        
                        # Important
                        "SG High Court": 1.2,
                        "Singapore International Commercial Court": 1.2,
                        "HK High Court": 1.2,
                        "HK Court of First Instance": 1.2,
                        "UK Crown Court": 1.2,
                        "UK Court of Appeal": 1.2,
                        "UK High Court": 1.2,
                        "Federal Court of Australia": 1.2,
                        "NSW Court of Appeal": 1.2,
                        "NSW Court of Criminal Appeal": 1.2,
                        "NSW Supreme Court": 1.2,
                        
                        # Default
                        "default": 1.0
                    }
                    court_boost_value = court_boost.get(court, court_boost["default"])
                    refined_scores[d] *= court_boost_value
                
                # apply recency boost (via date)
                if "date" in metadata[d]:
                    date_boost_value = calculate_date_boost(metadata[d]["date"])
                    refined_scores[d] *= date_boost_value
                    
        refined_ranked = sorted(refined_scores.items(), key=lambda x: (-x[1], x[0]))
        final_results = []
        for i in range(topk):
            final_results.append(refined_ranked[i][0])
    
    # write out results
    if out_fmt == "json":
        # simply emit the list of IDs as JSON
        print(json.dumps(final_results))
    else:
        # one-line, space-separated IDs
        print(" ".join(str(d) for d in final_results))
    
    postings_fh.close()

if __name__ == '__main__':
    main()