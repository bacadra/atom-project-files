'use babel'

import { CompositeDisposable } from 'atom'
var glob = require('glob')
var minimatch = require("minimatch")
const path = require('path');

export default class PathManager {

  constructor(S) {
    this.S = S
    this.ignores = []
    this.items   = null
    this.viewQ   = false
    this.editorQ = null

    this.disposables = new CompositeDisposable()

    this.disposables.add(

      atom.commands.add('atom-workspace', {
        'project-files:paths-cache' : () => this.cache(),
      }),

      atom.project.onDidChangeFiles((events) => { if (this.items) {this.updateEvent(events)} }),

      atom.project.onDidChangePaths( () => { this.items = null  }),

      atom.config.onDidChange('fuzzy-finder.ignoredNames', () => { this.items = null  }),

      atom.config.onDidChange('core.ignoredNames', () => { this.items = null  }),

      atom.config.onDidChange('project-files.ignoredNames', () => { this.items = null  }),
    )
  }

  destroy() {
    this.disposables.dispose()
  }

  cache(callback) {
    this.ignores = [
      ...atom.config.get('core.ignoredNames'),
      ...atom.config.get('fuzzy-finder.ignoredNames'),
      ...atom.config.get('project-files.ignoredNames'),
    ]
    this.items = []
    Promise.all(atom.project.getPaths().map(this.globPromise.bind(this))).then((errs) => {
      this.viewQ = false
      this.relativize()
      if (callback) {callback(errs)}
    })
  }

  globPromise(pPath) {
    return new Promise((resolve, _) => {
      glob('**', {cwd:pPath, silent:true, nosort:true, dot:true, ignore:this.ignores}, (err, match) => {
        for (let fPath of match) {
          this.items.push({ pPath: pPath, fPath: path.normalize(fPath) })
        }
        resolve(err)
      })
    })
  }

  updateEvent(events) {
    this.viewQ = false
    for (e of events) {
      if (e.action==='created') {
        if (createdSkipQ) {createdSkipQ=false ; continue}
        [pPath, fPath] = atom.project.relativizePath(e.path)
        if (this.isIgnored(fPath)) {continue}
        this.items.push({ pPath : pPath, fPath : fPath })

      } else if (e.action==='deleted') {
        // if dir, then only main dir is reported. subfiles must be searched manually
        [pPath, fPath] = atom.project.relativizePath(e.path)
        if (!pPath) {continue}
        removeIndexes = []
        for ( var i=0; i<this.items.length; i++){
          item = this.items[i]
          if (pPath===item.pPath && (fPath===item.fPath || item.fPath.startsWith(fPath+path.sep))) {
            removeIndexes.push(i)
          }
        }
        for (var i = removeIndexes.length-1; i >= 0; i--) {
          this.items.splice(removeIndexes[i], 1);
        }

      } else if (e.action==='renamed') {
        // strange behaviour of atom to push created event after renamed with old path
        createdSkipQ = true
        for ( item of this.items) {
          let [pOldPath, fOldPath] = atom.project.relativizePath(e.oldPath)
          let [pNewPath, fNewPath] = atom.project.relativizePath(e.path)
          if (pOldPath===item.pPath && (fOldPath===item.fPath || item.fPath.startsWith(fOldPath+path.sep))) {
            item.pPath = pNewPath
            item.fPath = item.fPath.replace(fOldPath, fNewPath)
          }
        }
      }
    }
  }

  relativize(editor) {
    if (!editor) { editor = atom.workspace.getActiveTextEditor()}
    editorPath = editor ? editor.getPath() : undefined
    if (!editor || !editorPath) {
      for (let item of this.items) {
        item.rPath = item.fPath
        item.distance = 1
      }
    } else {
      for (let item of this.items) {
        item.rPath = path.relative(path.dirname(editorPath), path.join(item.pPath, item.fPath))
        match = item.rPath.match(/[\/\\]/g)
        item.distance = match ? match.length+1 : 1
      }
    }
  }

  isIgnored(fPath) {
    for (ignore of this.ignores) {
      if (minimatch(fPath, ignore)) {return true}
    }
    return false
  }
}
