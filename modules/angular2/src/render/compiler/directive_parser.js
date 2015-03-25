import {isPresent, isBlank, BaseException, assertionsEnabled, RegExpWrapper} from 'angular2/src/facade/lang';
import {List, MapWrapper, ListWrapper} from 'angular2/src/facade/collection';
import {DOM} from 'angular2/src/dom/dom_adapter';
import {Parser} from 'angular2/change_detection';

import {SelectorMatcher, CssSelector} from './selector';

import {CompileStep} from './compile_step';
import {CompileElement} from './compile_element';
import {CompileControl} from './compile_control';

import {DirectiveMetadata} from '../api';

import {dashCaseToCamelCase, camelCaseToDashCase} from '../util';

/**
 * Parses the directives on a single element. Assumes ViewSplitter has already created
 * <template> elements for template directives.
 */
export class DirectiveParser extends CompileStep {
  _selectorMatcher:SelectorMatcher;
  _directives:List<DirectiveMetadata>;
  _parser:Parser;

  constructor(parser: Parser, directives:List<DirectiveMetadata>) {
    super();
    this._parser = parser;
    this._selectorMatcher = new SelectorMatcher();
    this._directives = directives;
    for (var i=0; i<directives.length; i++) {
      var selector = CssSelector.parse(directives[i].selector);
      this._selectorMatcher.addSelectables(selector, i);
    }
  }

  process(parent:CompileElement, current:CompileElement, control:CompileControl) {
    var attrs = current.attrs();
    var classList = current.classList();

    var cssSelector = new CssSelector();
    var nodeName = DOM.nodeName(current.element);
    cssSelector.setElement(nodeName);
    for (var i=0; i < classList.length; i++) {
      cssSelector.addClassName(classList[i]);
    }

    MapWrapper.forEach(attrs, (attrValue, attrName) => {
      cssSelector.addAttribute(attrName, attrValue);
    });

    this._selectorMatcher.match(cssSelector, (selector, directiveIndex) => {
      var elementBinder = current.bindElement();
      var directiveBinder = elementBinder.bindDirective(directiveIndex);
      // TODO: fill directiveBinder
      var directive = this._directives[directiveIndex];
      current.compileChildren = current.compileChildren && directive.compileChildren;
      if (isPresent(directive.bind)) {
        MapWrapper.forEach(directive.bind, (bindConfig, dirProperty) => {
          this._bindDirectiveProperty(dirProperty, bindConfig, current, directiveBinder);
        });
      }
      if (isPresent(directive.events)) {
        MapWrapper.forEach(directive.events, (action, eventName) => {
          this._bindDirectiveEvent(eventName, action, current, directiveBinder);
        });
      }
    });
  }

  _bindDirectiveProperty(dirProperty, bindConfig, compileElement, directiveBinder) {
    var pipes = this._splitBindConfig(bindConfig);
    var elProp = ListWrapper.removeAt(pipes, 0);

    var bindingAst = MapWrapper.get(
      compileElement.bindElement().propertyBindings,
      dashCaseToCamelCase(elProp)
    );

    if (isBlank(bindingAst)) {
      var attributeValue = MapWrapper.get(compileElement.attrs(), camelCaseToDashCase(elProp));
      if (isPresent(attributeValue)) {
        bindingAst = this._parser.wrapLiteralPrimitive(
          attributeValue,
          compileElement.elementDescription
        );
      }
    }

    // Bindings are optional, so this binding only needs to be set up if an expression is given.
    if (isPresent(bindingAst)) {
      var fullExpAstWithBindPipes = this._parser.addPipes(bindingAst, pipes);
      directiveBinder.bindProperty(
        dirProperty, fullExpAstWithBindPipes
      );
    }
  }

  _bindDirectiveEvent(eventName, action, compileElement, directiveBinder) {
    var ast = this._parser.parseAction(action, compileElement.elementDescription);
    directiveBinder.bindEvent(eventName, ast);
  }

  _splitBindConfig(bindConfig:string) {
    return ListWrapper.map(bindConfig.split('|'), (s) => s.trim());
  }
}


