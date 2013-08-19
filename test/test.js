var test = require('tape');
var Lang = require('../lang.js');
var Token = require('../src/token'),
    createSpec = require('spec-js');



////////////////////////////////////////////////////////////////////////
//
//   Yeah... kinda gota implement a programming language to test lang...
//
////////////////////////////////////////////////////////////////////////

var createNestingParser = Lang.createNestingParser,
    Token = Lang.Token,
    Scope = Lang.Scope;

function isIdentifier(substring){
    var valid = /^[$A-Z_][0-9A-Z_$]*/i,
        possibleIdentifier = substring.match(valid);

    if (possibleIdentifier && possibleIdentifier.index === 0) {
        return possibleIdentifier[0];
    }
}

function createKeywordTokeniser(Constructor, keyword){
    return function(substring){
        substring = isIdentifier(substring);
        if (substring === keyword) {
            return new Constructor(substring, substring.length);
        }
    };
}

function ParenthesesToken(){
}
ParenthesesToken = createSpec(ParenthesesToken, Token);
ParenthesesToken.prototype.name = 'parentheses'
ParenthesesToken.tokenise = function(substring) {
    if(substring.charAt(0) === '(' || substring.charAt(0) === ')'){
        return new ParenthesesToken(substring.charAt(0), 1);
    }
}
ParenthesesToken.prototype.parse = createNestingParser(new RegExp('^\\($'),new RegExp('^\\)$'));
ParenthesesToken.prototype.evaluate = function(scope){        
    for(var i = 0; i < this.childTokens.length; i++){
        this.childTokens[i].evaluate(scope);
    }

    this.result = this.childTokens.slice(-1)[0].result;
}

function NumberToken(){}
NumberToken = createSpec(NumberToken, Token);
NumberToken.prototype.name = 'number';
NumberToken.tokenise = function(substring) {
    var specials = {
        "NaN": Number.NaN,
        "-NaN": Number.NaN,
        "Infinity": Infinity,
        "-Infinity": -Infinity
    };
    for (var key in specials) {
        if (substring.slice(0, key.length) === key) {
            return new NumberToken(key, key.length);
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
        return new NumberToken(result, index);
    }

    return;
};
NumberToken.prototype.evaluate = function(scope){        
    this.result = parseFloat(this.original);
};


function SemicolonToken(){}
SemicolonToken = createSpec(SemicolonToken, Token);
SemicolonToken.prototype.name = 'semicolon';
SemicolonToken.tokenise = function(substring) {
    if(substring.charAt(0) === ';'){
        return new SemicolonToken(substring.charAt(0), 1);
    }
};
SemicolonToken.prototype.parse = function(tokens, position){
    var lastPosition = 0;

    for(var i = tokens.length - 1 - position; i >=0; i--){
        if(tokens[i] instanceof SemicolonToken){
            lastPosition = i;
            break;
        }
    }

    this.childTokens = tokens.splice(lastPosition, position - lastPosition);
};
SemicolonToken.prototype.evaluate = function(scope){        
    for(var i = 0; i < this.childTokens.length; i++){
        this.childTokens[i].evaluate(scope);
    }

    var lastChild = this.childTokens.slice(-1)[0];

    this.result = lastChild ? lastChild.result : undefined;
};

function NullToken(){}
NullToken = createSpec(NullToken, Token);
NullToken.prototype.name = 'semicolon';
NullToken.prototype.precedence = 2;
NullToken.tokenise = createKeywordTokeniser(NullToken, "null");
NullToken.prototype.parse = function(tokens, position){
};
NullToken.prototype.evaluate = function(scope){
    this.result = null;
};

function VariableToken(){}
VariableToken = createSpec(VariableToken, Token);
VariableToken.prototype.name = 'semicolon';
VariableToken.prototype.precedence = 2;
VariableToken.tokenise = createKeywordTokeniser(VariableToken, "var");
VariableToken.prototype.parse = function(tokens, position){
    this.identifierKey = tokens[position + 1].original;
};
VariableToken.prototype.evaluate = function(scope){
    scope.set(this.identifierKey, undefined);
    this.result = undefined;
};


function DelimiterToken(){}
DelimiterToken = createSpec(DelimiterToken, Token);
DelimiterToken.prototype.name = 'delimiter';
DelimiterToken.prototype.precedence = 2;
DelimiterToken.tokenise = function(substring) {
    var i = 0;
    while(i < substring.length && substring.charAt(i).trim() === "" || substring.charAt(i) === ',') {
        i++;
    }

    if(i){
        return new DelimiterToken(substring.slice(0, i), i);
    }
};
DelimiterToken.prototype.parse = function(tokens, position){
    tokens.splice(position, 1);
};

var tokenConverters = [
        ParenthesesToken,
        NumberToken,
        SemicolonToken,
        NullToken,
        VariableToken,
        DelimiterToken
    ];

    /*
{
    name:"assigment",
    precedence: 6,
    tokenise: function(substring) {
        var opperatorConst = "="
        if (substring.charAt(0) === opperatorConst) return new Token(opperatorConst, 1);
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
        if (substring.charAt(0) === opperatorConst) return new Token(opperatorConst, 1);
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
        if (substring.charAt(0) === opperatorConst) return new Token(opperatorConst, 1);
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
        if (substring.charAt(0) === opperatorConst) return new Token(opperatorConst, 1);
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
        if (substring.charAt(0) === opperatorConst) return new Token(opperatorConst, 1);
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

        if (i) return new Token(substring.slice(0, i), i);
    },
    parse:function(tokens, position){
        tokens.splice(position, 1);
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
            return new Token(result, result.length);
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
*/

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
// test("2 * 4", function (t) {
//   t.plan(1);
//   t.equal(ample.evaluate("8"), 1);
// });
// test("2 * 4 - 2", function (t) {
//   t.plan(1);
//   t.equal(ample.evaluate("6"), 1);
// });
// test("2 * (4 - 2)", function (t) {
//   t.plan(1);
//   t.equal(ample.evaluate("4"), 1);
// });
// test("a = 5 a", function (t) {
//   t.plan(1);
//   t.equal(ample.evaluate("var a = 5; a"), 5);
// });