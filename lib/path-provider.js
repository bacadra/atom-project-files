'use babel'

import { CompositeDisposable } from 'atom'
const zadeh = require("zadeh")

export default class PathProvider {

  constructor(S) {
    this.S = S
    this.disposables = new CompositeDisposable()
    this.selector = '*';
		this.suggestionPriority = 999;

    this.disposables.add(

      atom.config.observe('project-files.autocompletePath', (value) => {
        this.autocompletePath = value
      }),

      atom.config.observe('project-files.insertSep', (value) => {
        this.insertSep = value
      }),
    )
  }

  dispose() {
    this.disposables.dispose()
  }

  getSuggestions(options) {
    if (!this.autocompletePath) {return}
		const { editor, bufferPosition } = options;
		code = editor.getTextInRange([[bufferPosition.row, 0], bufferPosition]);
		if (match = code.match(/\/\/\/(.+)$/)) {
      query = match[1]
      return this.findMatchingSuggestions(query)
		};
	}

	findMatchingSuggestions(query) {
    if (this.S.pathManager.loadQ) {return}
		return this.filter(this.S.pathManager.items, query).map((item) => {
      aPath = path.join(item.pPath, item.fPath)
      if (this.S.getIconClass) {
        iconClass = this.S.getIconClass(aPath).join(' ')
      } else {
        iconClass = 'default-icon'
      }
      rPath = this.formatSep(item.rPath)
			return {
				text              : rPath,
				displayText       : rPath,
				replacementPrefix : `///${query}`,
        rightLabel        : 'Path',
				className         : 'constant',
        iconHTML          : `<i class="${iconClass} icon"></i>`,
        description       : aPath,
			}
		})
	}

  filter(items, query) {
    if (query.length===0) { return items }
    scoredItems = []
    for (let item of items) {
      item.score = zadeh.score(item.fPath, query)
      if (item.score<=0) { continue }
      item.score = item.score/item.distance
      scoredItems.push(item)
    }
    return scoredItems.sort((a,b) => b.score-a.score).slice(0, 20)
  }

  formatSep(text) {
    if (this.insertSep===0) {
      return text
    } else if (this.insertSep===1) {
      return text.replace(/\\/g, '/')
    } else if (this.insertSep===2) {
      return text.replace(/\//g, '\\')
    }
  }

}
