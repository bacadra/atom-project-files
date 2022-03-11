'use babel'

import { CompositeDisposable, Disposable } from 'atom'
import PathListView from './path-list-view'
import ProjListView from './proj-list-view'

// import { execSync } from 'child_process'
// import pathListView from './path-finder-view'
// import LineTextView from './line-text-view';
// const { shell } = require('electron')
// const path = require('path');
// var fs = require("fs")
// var CSON = require('cson')
// var glob = require('glob')
// import { chdir, cwd } from 'process';


export default {
  config: {
    preserveLastSearch: {
      title: 'Preserve last search',
      description: 'Preserve the last search when reopening the cite pallete',
      type: 'boolean',
      default: true,
    },
    useAlternateScoring: {
      title: 'Use alternate scoring',
      description: 'Use an alternative scoring approach which prefers run of consecutive characters, acronyms and start of words',
      type: 'boolean',
      default: false,
    },
    localWeight: {
      title: 'The weight of relative coherence',
      description: 'If file is far from active text editor, then it score are lowered by length of relative path elements multiply by this factor',
      type: 'number',
      default: 0.2,
      minimum: 0.0,
      maximum: 1.0,
    },
    ignoredNames: {
      type: "array",
      default: ['.*', '_*'],
      description: "List of string glob patterns. Files and directories matching these patterns will be ignored. This list is merged with the list defined by the core `Ignored Names` config setting. Example: `.git, _*, Thumbs.db`."
    },
  },


  activate (_state) {
    this.disposables = new CompositeDisposable()

    this.pathListView = new PathListView()
    this.projListView = new ProjListView()

    this.disposables.add(atom.commands.add('atom-workspace', {
      'project-files:paths-toggle'   : () => this.pathListView.toggle(),
      'project-files:paths-recache'  : () => {
        this.pathListView.cache()
        this.pathListView.toggle()
      },
      'project-files:projects-toggle': () => this.projListView.toggle(),
      'project-files:projects-edit'  : () => this.projListView.edit(),
    }))
  },


  deactivate () {
    this.disposables.dispose()
    this.pathListView.destroy()
    this.projListView.destroy()
  },


  consumeElementIcons(func) {
  	this.pathListView.addIconToElement = func;
  },

};
