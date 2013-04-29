var test = require('tape');
var Lang = require('../lang.js');




////////////////////////////////////////////////////////////////////////
//
//   Yeah... kinda gota implement a programming language to test lang...
//
////////////////////////////////////////////////////////////////////////

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

function createKeywordTokeniser(keyword){
    return function(substring){
        substring = isIdentifier(substring);
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
            name:"semicolon",
            precedence: 1,
            tokenise: function(substring) {
                if(substring.charAt(0) === ';'){
                    return new Token(this, substring.charAt(0), 1);
                }
            },
            parse:function(tokens, position){
                var lastPosition = 0;

                for(var i = tokens.length - position; i >=0; i--){
                    if(tokens[i].name === this.name){
                        lastPosition = i;
                        break;
                    }
                }

                this.childTokens = tokens.splice(lastPosition, position - lastPosition);
            },
            evaluate:function(scope){        
                for(var i = 0; i < this.childTokens.length; i++){
                    this.childTokens[i].evaluate(scope);
                }

                var lastChild = this.childTokens.slice(-1)[0];

                this.result = lastChild ? lastChild.result : undefined;
            }
        },
        {
            name:"variable",
            precedence: 2,
            tokenise: createKeywordTokeniser("var"),
            parse: function(tokens, position){
                this.identifierKey = tokens[position + 1].original;
            },
            evaluate:function(scope){
                console.log(this.identifierKey);
                scope.set(this.identifierKey, null);
                this.result = undefined;
            }
        },
        {
            name:"assigment",
            precedence: 6,
            tokenise: function(substring) {
                var opperatorConst = "="
;                if (substring.charAt(0) === opperatorConst) return new Token(this, opperatorConst, 1);
                return;
            },
            parse: function(tokens, position){
                this.leftToken = tokens.splice(position-1,1)[0];
                this.rightToken = tokens.splice(position,1)[0];
            },
            evaluate:function(scope){
                this.rightToken.evaluate(scope);
                scope.set(this.leftToken.original, this.rightToken.result, true);
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
            name:"null",
            precedence: 2,
            tokenise: createKeywordTokeniser("null"),
            evaluate:function(){
                this.result = null;
            }
        },
        {
            name:"identifier",
            precedence: 6,
            tokenise: function(substring){
                var result = isIdentifier(substring);

                if(result != null){
                    return new Token(this, result, result.length);
                }
            },
            evaluate:function(scope){
                if(scope.isDefined(this.original)){
                    this.result = scope.get(this.original);
                }else{
                    throw "Attempted to reference an non-existant identifier: " + this.original;
                }
            }
        }
    ];


var Ample = function(){    
    var ample = {},
        lang = new Lang();
        
    ample.lang = lang;
    ample.tokenise = function(expression){
        return ample.lang.tokenise(expression, tokenConverters);
    }
    ample.evaluate = function(expression, injectedScope, returnAsTokens){
        var scope = new Lang.Scope();

        scope.add(injectedScope);

        return lang.evaluate(expression, scope, tokenConverters, returnAsTokens);
    };
    
    return ample;
};

/************************************/

var ample = new Ample();


test("1", function (t) {
  t.plan(1);
  t.equal(ample.evaluate("1"), 1);
});
test("-2", function (t) {
  t.plan(1);
  t.equal(ample.evaluate("-2"), -2);
});
test("2.4e9", function (t) {
  t.plan(1);
  t.equal(ample.evaluate("2.4e9"), 2400000000);
});
test("1.0E-3", function (t) {
  t.plan(1);
  t.equal(ample.evaluate("1.0E-3"), 0.001);
});
test("null", function (t) {
  t.plan(1);
  t.equal(ample.evaluate("null"), null);
});
test("5; 3", function (t) {
  t.plan(1);
  t.equal(ample.evaluate("5; 3"), 3);
});
test("a = 5 a", function (t) {
  t.plan(1);
  t.equal(ample.evaluate("var a = 5; a"), 5);
});