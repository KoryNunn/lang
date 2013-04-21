(function(global, undefined){

    var createNestingParser = Lang.createNestingParser,
        detectString = Lang.detectString,
        Token = Lang.Token,
        Scope = Lang.Scope;

    function isIdentifier(substring){
        var valid = /^[$A-Z_][0-9A-Z_$]*/i,
            possibleIdentifier = substring.match(valid);

        if (possibleIdentifier && possibleIdentifier.index === 0) {
            return possibleIdentifier[0];
        }
    }

    function tokeniseIdentifier(substring){
        // searches for valid identifiers or operators
        //operators
        var operators = "!=<>/&|*%-^?+\\",
            index = 0;
            
        while (operators.indexOf(substring.charAt(index)||null) >= 0 && ++index) {}

        if (index > 0) {
            return substring.slice(0, index);
        }

        var identifier = isIdentifier(substring);

        if(identifier != null){
            return identifier;                        
        }
    }

    function createKeywordTokeniser(keyword){
        return function(substring){
            substring = tokeniseIdentifier(substring);
            if (substring === keyword) {
                return new Token(this, substring, substring.length);
            }
        };
    }

    var tokenConverters = [
            {
                name:"parentheses",
                precedence: 0,
                tokenise: function(substring) {
                    if(substring.charAt(0) === '(' || substring.charAt(0) === ')'){
                        return new Token(this, substring.charAt(0), 1);
                    }
                },
                parse:createNestingParser(new RegExp('^\\($'),new RegExp('^\\)$')),
                evaluate:function(scope){        
                    for(var i = 0; i < this.childTokens.length; i++){
                        this.childTokens[i].evaluate(scope);
                    }

                    this.result = this.childTokens.slice(-1)[0].result;
                }
            },
            {
                name:"period",
                precedence: 1,
                tokenise: function (substring) {
                    var opperatorConst = ".";
                    if (substring.charAt(0) === opperatorConst) return new Token(this, opperatorConst, 1);
                    return;
                },
                parse: function(tokens, position){
                    this.targetToken = tokens.splice(position-1,1)[0];
                    this.identifierToken = tokens.splice(position,1)[0];
                },
                evaluate:function(scope){
                    this.targetToken.evaluate(scope);
                    if(
                        this.targetToken.result &&
                        (typeof this.targetToken.result === 'object' || typeof this.targetToken.result === 'function')
                        && this.targetToken.result.hasOwnProperty(this.identifierToken.original)
                    ){
                        this.result = this.targetToken.result[this.identifierToken.original];
                    }else{
                        this.result = undefined;
                    }
                }
            },
            {
                name:"assigment",
                precedence: 6,
                tokenise: function(substring) {
                    var opperatorConst = "=";
                    if (substring.charAt(0) === opperatorConst) return new Token(this, opperatorConst, 1);
                    return;
                },
                parse: function(tokens, position){
                    this.leftToken = tokens.splice(position-1,1)[0];
                    this.rightToken = tokens.splice(position,1)[0];
                },
                evaluate:function(scope){
                    this.rightToken.evaluate(scope);
                    scope.set(this.leftToken.original, this.rightToken.result);
                    this.result = undefined;
                }
            },
            {
                name:"addition",
                precedence: 5,
                tokenise: function(substring) {
                    var opperatorConst = "+";
                    if (substring.charAt(0) === opperatorConst) return new Token(this, opperatorConst, 1);
                    return;
                },
                parse: function(tokens, position){
                    this.leftToken = tokens.splice(position-1,1)[0];
                    this.rightToken = tokens.splice(position,1)[0];
                },
                evaluate:function(scope){
                    this.leftToken.evaluate(scope);
                    this.rightToken.evaluate(scope);
                    this.result = this.leftToken.result + this.rightToken.result;
                }
            },
            {
                name:"subtraction",
                precedence: 4,
                tokenise: function(substring) {
                    var opperatorConst = "-";
                    if (substring.charAt(0) === opperatorConst) return new Token(this, opperatorConst, 1);
                    return;
                },
                parse: function(tokens, position){
                    this.leftToken = tokens.splice(position-1,1)[0];
                    this.rightToken = tokens.splice(position,1)[0];
                },
                evaluate:function(scope){
                    this.leftToken.evaluate(scope);
                    this.rightToken.evaluate(scope);
                    this.result = this.leftToken.result - this.rightToken.result;
                }
            },
            {
                name:"multiplication",
                precedence: 3,
                tokenise: function(substring) {
                    var opperatorConst = "*";
                    if (substring.charAt(0) === opperatorConst) return new Token(this, opperatorConst, 1);
                    return;
                },
                parse: function(tokens, position){
                    this.leftToken = tokens.splice(position-1,1)[0];
                    this.rightToken = tokens.splice(position,1)[0];
                },
                evaluate:function(scope){
                    this.leftToken.evaluate(scope);
                    this.rightToken.evaluate(scope);
                    this.result = this.leftToken.result * this.rightToken.result;
                }
            },
            {
                name:"division",
                precedence: 3,
                tokenise: function(substring) {
                    var opperatorConst = "/";
                    if (substring.charAt(0) === opperatorConst) return new Token(this, opperatorConst, 1);
                    return;
                },
                parse: function(tokens, position){
                    this.leftToken = tokens.splice(position-1,1)[0];
                    this.rightToken = tokens.splice(position,1)[0];
                },
                evaluate:function(scope){
                    this.leftToken.evaluate(scope);
                    this.rightToken.evaluate(scope);
                    this.result = this.leftToken.result / this.rightToken.result;
                }
            },
            {
                name:"delimiter",
                precedence: 0,
                tokenise: function(substring) {
                    var i = 0;
                    while (i < substring.length && substring.charAt(i).trim() === "" || substring.charAt(i) === ',') {
                        i++;
                    }
            
                    if (i) return new Token(this, substring.slice(0, i), i);
                },
                parse:function(tokens, position){
                    tokens.splice(position, 1);
                }
            },
            {
                name:"number",
                precedence: 1,
                tokenise: function(substring) {
                    var specials = {
                        "NaN": Number.NaN,
                        "-NaN": Number.NaN,
                        "Infinity": Infinity,
                        "-Infinity": -Infinity
                    };
                    for (var key in specials) {
                        if (substring.slice(0, key.length) === key) {
                            return new Token(this, key, key.length);
                        }
                    }
            
                    var valids = "0123456789-.Eex",
                        index = 0;
                        
                    while (valids.indexOf(substring.charAt(index)||null) >= 0 && ++index) {}
            
                    if (index > 0) {
                        var result = substring.slice(0, index);
                        if(isNaN(parseFloat(result))){
                            return;
                        }
                        return new Token(this, result, index);
                    }
            
                    return;
                },
                evaluate:function(){
                    this.result = parseFloat(this.original);
                }
            },
            {
                name:"identifier",
                precedence: 6,
                tokenise: function(substring){
                    var result = tokeniseIdentifier(substring);

                    if(result != null){
                        return new Token(this, result, result.length);
                    }
                },
                evaluate:function(scope){
                    this.result = scope.get(this.original);
                }
            }
        ],
        scope = {};

    
    global.Ample = function(){    
        var ample = {},
            lang = new Lang();
            
        ample.lang = lang;
        ample.tokenise = function(expression){
            return ample.lang.tokenise(expression, this.tokenConverters);
        }
        ample.evaluate = function(expression, injectedScope, returnAsTokens){
            var scope = new Lang.Scope();

            scope.add(this.scope).add(injectedScope);

            return lang.evaluate(expression, scope, this.tokenConverters, returnAsTokens);
        };
        ample.tokenConverters = tokenConverters.slice();
        ample.scope = {__proto__:scope};
        
        return ample;
    };
    
})(this);