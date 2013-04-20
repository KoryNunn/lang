(function(global, undefined){

    function fastEach(items, callback) {
        for (var i = 0; i < items.length; i++) {
            if (callback(items[i], i, items)) break;
        }
        return items;
    }
    
    function Token(converter, substring, characters){
        simpleExtend(this, converter);
        this.original = substring;
        this.length = characters;
    }
    
    function simpleExtend(target, source){
        for(var key in source){
            if(source.hasOwnProperty(key)){
                target[key] = source[key];
            }
        }
    }
    
    function callWith(fn, fnArguments, calledToken){
        var argIndex = 0,
            scope = this,
            args = {
                callee: calledToken,
                length: fnArguments.length,
                raw: function(evaluated){
                    var rawArgs = fnArguments.slice();
                    if(evaluated){
                        fastEach(rawArgs, function(arg){
                            if(arg instanceof Token){
                                arg.evaluate(scope);
                            }
                        });
                    }
                    return rawArgs;
                },
                get: function(index){
                    var arg = fnArguments[index];
                        
                    if(arg instanceof Token){
                        arg.evaluate(scope);
                        return arg.result;
                    }
                    return arg;
                },
                hasNext: function(){
                    return argIndex < fnArguments.length;
                },
                next: function(){
                    if(!this.hasNext()){
                        throw "Incorrect number of arguments";
                    }
                    if(fnArguments[argIndex] instanceof Token){
                        fnArguments[argIndex].evaluate(scope);
                        return fnArguments[argIndex++].result;
                    }
                    return fnArguments[argIndex++];
                },
                all: function(){
                    var allArgs = [];
                    while(this.hasNext()){
                        allArgs.push(this.next());
                    }
                    return allArgs;
                }
            };
            
        return fn(scope, args);
    }

    function Scope(oldScope){
        this.__scope__ = {};
        this.__outerScope__ = oldScope;
    }
    Scope.prototype.get = function(key){
        if(key in this.__scope__){
            return this.__scope__[key];
        }
        return this.__outerScope__ && this.__outerScope__.get(key);
    };
    Scope.prototype.set = function(key, value){
        this.__scope__[key] = value;
        return this;
    };
    Scope.prototype.add = function(obj){
        for(var key in obj){
            this.__scope__[key] = obj[key];
        }
        return this;
    };
    Scope.prototype.callWith = callWith;
    
    // Takes a start and end regex, returns an appropriate parse function
    function createNestingParser(openRegex, closeRegex){
        return function(tokens, index){
            if(this.original.match(openRegex)){
                var position = index,
                    opens = 1;
                    
                while(position++, position <= tokens.length && opens){
                    if(!tokens[position]){
                        throw "Invalid nesting. No closing token was found matching " + closeRegex.toString();
                    }
                    if(tokens[position].original.match(openRegex)){
                        opens++;
                    }
                    if(tokens[position].original.match(closeRegex)){
                        opens--;
                    }
                }

                // remove all wrapped tokens from the token array, including nest end token.
                var childTokens = tokens.splice(index + 1, position - 1 - index);

                // Remove the nest end token.
                childTokens.pop();

                // parse them, then add them as child tokens.
                this.childTokens = parse(childTokens);
                
                //Remove nesting end token
            }else{
                // If a nesting end token is found during parsing,
                // there is invalid nesting,
                // because the opening token should remove its closing token.
                throw "Invalid nesting. No opening token was found matching " + openRegex.toString();
            }
        };
    }

    function detectString(converter, expression, stringTerminal, stringType) {
        if (expression.charAt(0) === stringTerminal) {
            var index = 0,
            escapes = 0;
                   
            while (expression.charAt(++index) !== stringTerminal)
            {
               if(index >= expression.length){
                       throw "Unclosed "+ stringType + " string";
               }
               if (expression.charAt(index) === '\\' && expression.charAt(index+1) === stringTerminal) {
                       expression = expression.slice(0, index) + expression.slice(index + 1);
                       escapes++;
               }
            }

            return new Token(
               converter,
               expression.slice(0, index+1),
               index + escapes + 1
            );
        }
    }
    
    function scanForToken(tokenisers, expression){
        for (var i = 0; i < tokenisers.length; i++) {
            var token = tokenisers[i].tokenise(expression);
            if (token) {                
                return token;
            }
        }
    }

    function sortByPrecedence(items){
        return items.slice().sort(function(a,b){
            var precedenceDifference = a.precedence - b.precedence;
            return precedenceDifference ? precedenceDifference : items.indexOf(a) - items.indexOf(b);
        });
    }

    function tokenise(expression, tokenConverters, memoisedTokens) {
        if(!expression){
            return [];
        }
        
        if(memoisedTokens && memoisedTokens[expression]){
            return memoisedTokens[expression].slice();
        }

        tokenConverters = sortByPrecedence(tokenConverters);
        
        var originalExpression = expression,
            tokens = [],
            totalCharsProcessed = 0,
            previousLength,
            reservedKeywordToken;
        
        do {
            previousLength = expression.length;
            
            var token;

            token = scanForToken(tokenConverters, expression);
            
            if(token){
                expression = expression.slice(token.length);
                totalCharsProcessed += token.length;                    
                tokens.push(token);
                continue;
            }
            
            if(expression.length === previousLength){
                throw "Unable to determine next token in expression: " + expression;
            }
            
        } while (expression);
        
        memoisedTokens && (memoisedTokens[originalExpression] = tokens.slice());
        
        return tokens;
    }

    function parse(tokens){
        var parsedTokens = 0,
            tokensByPrecedence = sortByPrecedence(tokens),
            currentToken = tokensByPrecedence[0],
            tokenNumber = 0;

        while(currentToken && currentToken.parsed == true){
            currentToken = tokensByPrecedence[tokenNumber++];
        }

        if(!currentToken){
            return tokens;
        }

        if(currentToken.parse){
            currentToken.parse(tokens, tokens.indexOf(currentToken));
        }

        // Even if the token has no parse method, it is still concidered 'parsed' at this point.
        currentToken.parsed = true;
        
        return parse(tokens);
    }
    
    function evaluate(tokens, scope){        
        scope = scope || new Scope();
        for(var i = 0; i < tokens.length; i++){
            var token = tokens[i];
            token.evaluate(scope);
        }
        
        return tokens;
    }

    function printTopExpressions(stats){
        var allStats = [];
        for(var key in stats){
            allStats.push({
                expression: key,
                time: stats[key].time,
                calls: stats[key].calls,
                averageTime: stats[key].averageTime
            });
        }

        allStats.sort(function(stat1, stat2){
            return stat2.time - stat1.time;
        }).slice(-10).forEach(function(stat){
            console.log([
                "Expression: ",
                stat.expression,
                '\n',
                'Average evaluation time: ',
                stat.averageTime,
                '\n',
                'Total time: ',
                stat.time,
                '\n',
                'Call count: ',                    
                stat.calls
            ].join(''));
        });
    }
    
    global.Lang = function(){    
        var lang = {},
            memoisedTokens = {},
            memoisedExpressions = {};


        var stats = {};

        lang.printTopExpressions = function(){
            printTopExpressions(stats);
        }

        function addStat(stat){
            var expStats = stats[stat.expression] = stats[stat.expression] || {time:0, calls:0};

            expStats.time += stat.time;
            expStats.calls++;
            expStats.averageTime = expStats.time / expStats.calls;
        }

        lang.parse = parse;
        lang.tokenise = function(expression, tokenConverters){
            return tokenise(expression, tokenConverters, memoisedTokens);
        };
        lang.evaluate = function(expression, scope, tokenConverters, returnAsTokens){
            var langInstance = this,
                memoiseKey = expression,
                expressionTree,
                evaluatedTokens,
                lastToken;

            if(!(scope instanceof Scope)){
                scope.add(injectedScope);
            }

            if(memoisedExpressions[memoiseKey]){
                expressionTree = memoisedExpressions[memoiseKey].slice();
            } else{            
                expressionTree = langInstance.parse(langInstance.tokenise(expression, tokenConverters, memoisedTokens));
                
                memoisedExpressions[memoiseKey] = expressionTree;
            }
            
            var startTime = new Date();
            evaluatedTokens = evaluate(expressionTree , scope);
            addStat({
                expression: expression,
                time: new Date() - startTime
            });
            
            if(returnAsTokens){
                return evaluatedTokens.slice();
            }
                
            lastToken = evaluatedTokens.slice(-1).pop();
            
            return lastToken && lastToken.result;
        };
        
        lang.callWith = callWith;
        return lang;
    };

    Lang.createNestingParser = createNestingParser;
    Lang.detectString = detectString;
    Lang.Scope = Scope;
    Lang.Token = Token;
    
})(this);