'use babel'

import { CompositeDisposable } from 'atom'
import fuzzaldrin from 'fuzzaldrin'
import fuzzaldrinPlus from 'fuzzaldrin-plus'

export default class PathProvider {

  constructor(S) {
    this.S = S
    this.disposables = new CompositeDisposable()
    this.selector = '*';
		this.suggestionPriority = 999;

    this.disposables.add(
      atom.config.observe('command-palette.useAlternateScoring', (value) => {
        this.useAlternateScoring = value
      }),
      atom.config.observe('project-files.autocompletePath', (value) => {
        this.autocompletePath = value
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
			return {
				text              : item.rPath,
				displayText       : item.rPath,
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
      item.score = this.fuzz.score(item.fPath, query)
      if (item.score<=0) { continue }
      item.score = item.score/item.distance
      scoredItems.push(item)
    }
    return scoredItems.sort((a,b) => b.score-a.score).slice(0, 20)
  }

  get fuzz () {
    return this.useAlternateScoring ? fuzzaldrinPlus : fuzzaldrin
  }

}
