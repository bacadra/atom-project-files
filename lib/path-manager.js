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

      atom.project.onDidChangeFiles((events) => {this.updateEvent(events)}),

      atom.config.onDidChange('fuzzy-finder.ignoredNames', () => {this.cache()}),

      atom.config.onDidChange('core.ignoredNames', () => {this.cache()}),

      atom.config.onDidChange('project-files.ignoredNames', () => {this.cache()}),
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
          this.items.push({
            pPath: pPath,
            fPath: path.normalize(fPath),
          })
        }
        resolve(err)
      })
    })
  }

  updateEvent(events) {
    this.viewQ = false
    let skipQ = false;
    if (!this.items) {return}
    for (let event of events) {
      if (skipQ) {
        skipQ = false
        continue
      } else if (event.action==="created") {
        [pPath, fPath] = atom.project.relativizePath(event.path)
        if (this.isIgnored(fPath)) {continue}
        this.items.push(item = {
						pPath : pPath,
						fPath : fPath,
				})
      } else if (event.action==="deleted") {
        for ( var i = 0; i < this.items.length; i++){
          item = this.items[i]
          if (path.join(item.pPath, item.fPath)===event.path) {
            this.items.splice(i, 1)
            break
          }
        }
      } else if (event.action==='renamed') {
        this.updateEvent([
            {action: "deleted", path:event.oldPath},
            {action: "created", path:event.path},
        ])
        skipQ = true
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
