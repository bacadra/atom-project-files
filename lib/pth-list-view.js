'use babel'

const {CompositeDisposable} = require('atom')
import SelectListView from 'atom-select-list'
import fuzzaldrin from 'fuzzaldrin'
import fuzzaldrinPlus from 'fuzzaldrin-plus'
var fs = require("fs")
var path = require('path')
var glob = require('glob')
import { chdir, cwd } from 'process';
const { shell } = require('electron')
var Minimatch = require("minimatch").Minimatch

export default class PthListView {

  constructor () {
    this.selectListView = new SelectListView({
      items: [],
      filter: this.filter,
      emptyMessage: ' [NO MATCHES FOUND]',
      infoMessage: 'Press `enter`, `alt-enter`, `ctrl-r`, `ctrl-a`, `ctrl-p` or `ctrl-n`',
      maxResults: 50,
      elementForItem: (item, {index, selected, visible}) => {
        if (!visible) {
          return document.createElement("li")
        }

        const li = document.createElement('li')
        li.classList.add('event', 'two-lines')

        const rightBlock = document.createElement('div')
        rightBlock.classList.add('pull-right')

        const leftBlock = document.createElement('div')
        const titleEl = document.createElement('div')
        titleEl.classList.add('primary-line')
        if (this.addIconToElement) {
          titleEl.classList.add('icon')
          if (item.type=='File') {
            this.addIconToElement(titleEl, item.fPath);
          } else {
            titleEl.classList.add('icon-file-directory')
          }
        }

        leftBlock.appendChild(titleEl)

        const query = this.selectListView.getQuery()
        this.highlightMatchesInElement(item.displayName, query, titleEl)

        let secondaryEl = document.createElement('div')
        secondaryEl.classList.add('secondary-line')

        if (typeof item.description === 'string') {
          secondaryEl.appendChild(this.createDescription(item.description, query))
        }

        if (Array.isArray(item.tags)) {
          const matchingTags = item.tags
            .map(t => [t, this.fuzz.score(t, query)])
            .filter(([t, s]) => s > 0)
            .sort((a, b) => a.s - b.s)
            .map(([t, s]) => t)

          if (matchingTags.length > 0) {
            secondaryEl.appendChild(this.createTags(matchingTags, query))
          }
        }

        leftBlock.appendChild(secondaryEl)

        li.appendChild(leftBlock)
        return li
      },

      didConfirmSelection: (item) => {
        this.hide()
        const editor = atom.workspace.getActiveTextEditor()


        // open in atom
        if (this.insMode==='open-in') {
          if (item.type==='Directory') {return}
          text = path.join(item.pPath, item.fPath)
          atom.workspace.open(text)

        // open external
        } else if (this.insMode==='open-ex') {
          text = path.join(item.pPath, item.fPath)
          shell.openPath(text)

        // insert project path
        } else if (this.insMode==='ins-p') {
          if (!editor) {return}
          text = item.fPath
          editor.insertText(text.replace(/\\/g, '/'))

        // insert absolute path
        } else if (this.insMode==='ins-a') {
          if (!editor) {return}
          text = path.join(item.pPath, item.fPath)
          editor.insertText(text.replace(/\\/g, '/'))

        // insert relative path
        } else if (this.insMode==='ins-r') {
          if (!editor) {return}
          text = path.relative(path.join(editor.getPath(), '..'), path.join(item.pPath, item.fPath))
          editor.insertText(text.replace(/\\/g, '/'))

        // insert only name
        } else if (this.insMode==='ins-n') {
          if (!editor) {return}
          text = path.basename(item.fPath)
          editor.insertText(text)
        }
      },

      didCancelSelection: () => {
        this.hide()
      }
    })

    atom.commands.add(this.selectListView.element, {
      'pth-list:open-in': (event) => {
        this.insMode = 'open-in'
        this.selectListView.confirmSelection();
        event.stopPropagation();
      },
      'pth-list:open-ex': (event) => {
        this.insMode = 'open-ex'
        this.selectListView.confirmSelection();
        event.stopPropagation();
      },
      'pth-list:ins-p': (event) => {
        this.insMode = 'ins-p'
        this.selectListView.confirmSelection();
        event.stopPropagation();
      },
      'pth-list:ins-a': (event) => {
        this.insMode = 'ins-a'
        this.selectListView.confirmSelection();
        event.stopPropagation();
      },
      'pth-list:ins-r': (event) => {
        this.insMode = 'ins-r'
        this.selectListView.confirmSelection();
        event.stopPropagation();
      },
      'pth-list:ins-n': (event) => {
        this.insMode = 'ins-n'
        this.selectListView.confirmSelection();
        event.stopPropagation();
      },
    })

    this.localWeight = atom.config.get('project-files.localWeight')
    this.selectListView.element.classList.add('command-palette')
    this.selectListView.element.classList.add('project-files')
    this.selectListView.element.classList.add('pth-list')

    this.disposables = new CompositeDisposable()
    this.reloadIgnore = true
    this.disposables.add(atom.config.onDidChange(
        'fuzzy-finder.ignoredNames', () => { this.reloadIgnore = true }))
    this.disposables.add(atom.config.onDidChange(
        'core.ignoredNames', () => { this.reloadIgnore = true }))
    this.disposables.add(atom.config.onDidChange(
        'project-files.ignoredNames', () => { this.reloadIgnore = true }))

    this.disposables.add(
      atom.project.onDidChangeFiles(events=>{this.updateByEvent(events)}
    ));

    this.disposables.add(
      atom.config.onDidChange('project-files.localWeight', {}, (event)=>{
          this.localWeight = event.newValue
      })
    );

  }


  async destroy () {
    await this.selectListView.destroy()
    this.disposables.dispose()
  }


  toggle () {
    if (this.panel && this.panel.isVisible()) {
      this.hide()
      return Promise.resolve()
    } else {
      return this.show()
    }
  }


  loadIgnores () {
    ignores = []
    ignores.push(...atom.config.get('core.ignoredNames'))
    ignores.push(...atom.config.get('fuzzy-finder.ignoredNames'))
    ignores.push(...atom.config.get('project-files.ignoredNames'))
    this.ignores = []
    for (ignore of ignores) {
      this.ignores.push(new Minimatch(ignore, {matchBase: true, dot: true}))
      this.ignores.push(new Minimatch(`**/${ignore}/**`, {matchBase: true, dot: true}))
    }
  }


  checkIgnore(fPath) {
    for (ignore of this.ignores) {
      if (ignore.match(fPath)) {
        return true
      }
    }
    return false
  }


  cache () {
		this.items = paths = []
    cwdZero = cwd()

    for (let pPath of atom.project.getPaths()) {
			chdir(pPath)
      for (let fPath of glob.sync('**', {cwd:pPath, silent:true, nosort:true, dot:true})) {
        if (this.checkIgnore(fPath)) {continue}
        paths.push(item = {
						pPath : pPath.replace(/\\/g, '/'),
						fPath : fPath.replace(/\\/g, '/'),
				})
        try {
          item.type = fs.lstatSync(fPath).isDirectory() ? 'Directory' : 'File'
        } catch (e) {
          item.type = undefined
        }
        item.displayName = item.fPath
        item.description = `${item.type} | ${item.pPath}`
      }
    }
		chdir(cwdZero)
  }


  relativeAll () {
    editor = atom.workspace.getActiveTextEditor()
    editorPath = editor.getPath()
    if (!editor || !editorPath) {
      for (let item of this.items) {
        item.distance = 0
      }
    } else {
      for (let item of this.items) {
        match = path.relative(editorPath, path.join(item.pPath, item.fPath)).match(/\/|\\/g)
        item.distance = match ? match.length : 0
      }
    }
  }


  updateByEvent (events) {
    let skipQ = false;
    if (!this.items) {return}
    for (let event of events) {
      if (skipQ) {
        skipQ = false
        continue
      } else if (event.action==="created") {
        [pPath, fPath] = atom.project.relativizePath(event.path)
        if (this.checkIgnore(fPath)) {continue}
        this.items.push(item = {
						pPath : pPath.replace(/\\/g, '/'),
						fPath : fPath.replace(/\\/g, '/'),
				})
        try {
          item.type = fs.lstatSync(event.path).isDirectory() ? 'Directory' : 'File'
        } catch (e) {
          item.type = undefined
        }
        item.displayName = item.fPath
        item.description = `${item.type} | ${item.pPath}`
      } else if (event.action==="deleted") {
        for ( var i = 0; i < this.items.length; i++){
          item = this.items[i]
          if (path.join(item.pPath, item.fPath)==event.path) {
            this.items.splice(i, 1)
            break
          }
        }
      } else if (event.action==='renamed') {
        this.updateByEvent([
            {action: "deleted", path:event.oldPath},
            {action: "created", path:event.path},
        ])
        skipQ = true
      }
    }
  }


  show () {
    if (!this.panel) {
      this.panel = atom.workspace.addModalPanel({item: this.selectListView})
    }
    if (atom.config.get('project-files.preserveLastSearch')) {
      this.selectListView.refs.queryEditor.selectAll()
    } else {
      this.selectListView.reset()
    }
    this.activeElement = (document.activeElement === document.body) ? atom.views.getView(atom.workspace) : document.activeElement
    if (this.reloadIgnore) { this.loadIgnores() }
    if (!this.items || this.reloadIgnore) { this.cache() }
    this.reloadIgnore = false
    this.relativeAll()
    this.selectListView.update({items: this.items})
    this.previouslyFocusedElement = document.activeElement
    this.panel.show()
    this.selectListView.focus()
  }


  hide () {
    this.panel.hide()
    if (this.previouslyFocusedElement) {
      this.previouslyFocusedElement.focus()
      this.previouslyFocusedElement = null
    }
  }


  get fuzz () {
    return atom.config.get('project-files:useAlternateScoring') ? fuzzaldrinPlus : fuzzaldrin
  }


  highlightMatchesInElement (text, query, el) {
    const matches = this.fuzz.match(text, query)
    let matchedChars = []
    let lastIndex = 0
    for (const matchIndex of matches) {
      const unmatched = text.substring(lastIndex, matchIndex)
      if (unmatched) {
        if (matchedChars.length > 0) {
          const matchSpan = document.createElement('span')
          matchSpan.classList.add('character-match')
          matchSpan.textContent = matchedChars.join('')
          el.appendChild(matchSpan)
          matchedChars = []
        }
        el.appendChild(document.createTextNode(unmatched))
      }
      matchedChars.push(text[matchIndex])
      lastIndex = matchIndex + 1
    }
    if (matchedChars.length > 0) {
      const matchSpan = document.createElement('span')
      matchSpan.classList.add('character-match')
      matchSpan.textContent = matchedChars.join('')
      el.appendChild(matchSpan)
    }
    const unmatched = text.substring(lastIndex)
    if (unmatched) {
      el.appendChild(document.createTextNode(unmatched))
    }
  }

  filter = (items, query) => {
    if (query.length === 0) {
      return items
    }
    const scoredItems = []
    for (const item of items) {
      let score = this.fuzz.score(item.displayName, query)
      if (item.tags) {
        score += item.tags.reduce(
          (currentScore, tag) => currentScore + this.fuzz.score(tag, query),
          0
        )
      }
      if (score > 0) {
        score -= item.distance*this.localWeight
        scoredItems.push({item, score})
      }
    }
    scoredItems.sort((a, b) => b.score - a.score)
    return scoredItems.map((i) => i.item)
  }


  createDescription (description, query) {
    const descriptionEl = document.createElement('div')

    // in case of overflow, give full contents on long hover
    descriptionEl.title = description

    Object.assign(descriptionEl.style, {
      flexGrow: 1,
      flexShrink: 1,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      overflow: 'hidden'
    })
    // this.highlightMatchesInElement(description, query, descriptionEl)
    descriptionEl.append(description)
    return descriptionEl
  }


  createTag (tagText, query) {
    const tagEl = document.createElement('li')
    Object.assign(tagEl.style, {
      borderBottom: 0,
      display: 'inline',
      padding: 0
    })
    this.highlightMatchesInElement(tagText, query, tagEl)
    return tagEl
  }


  createTags (matchingTags, query) {
    const tagsEl = document.createElement('ol')
    Object.assign(tagsEl.style, {
      display: 'inline',
      marginLeft: '4px',
      flexShrink: 0,
      padding: 0
    })

    const introEl = document.createElement('strong')
    introEl.textContent = 'matching tags: '

    tagsEl.appendChild(introEl)
    matchingTags.map(t => this.createTag(t, query)).forEach((tagEl, i) => {
      tagsEl.appendChild(tagEl)
      if (i < matchingTags.length - 1) {
        const commaSpace = document.createElement('span')
        commaSpace.textContent = ', '
        tagsEl.appendChild(commaSpace)
      }
    })
    return tagsEl
  }
}
