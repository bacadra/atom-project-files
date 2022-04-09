'use babel'

import PathManager     from './path-manager'
import PathListView    from './path-list-view'
import PathProvider    from './path-provider'
import ProjectListView from './project-list-view'
import RecentListView  from './recent-list-view'

export default {

  config: {
    ignoredNames: {
      title: 'List of string glob patterns',
      description: "Files and directories matching these patterns will be ignored. This list is merged with the list defined by the core `Ignored Names` config setting. Example: `**/.git/**, **/__pycache__/**`.",
      type: "array",
      default: ['**/.git/**', '**/.dev/**', '**/__pycache__/**'],
    },
    insertSep: {
      title: "Type of separator in file paths",
      description: 'Type of separator for the file path when copying or pasting',
      type: 'integer',
      default: 0,
      enum: [
        {value: 0, description: 'Default'},
        {value: 1, description: 'Forward Slash'},
        {value: 2, description: 'Backslash'},
      ],
    },
    useIcons: {
      title: "Show icons from package file-icons",
      description: 'Show icon before each item in list. The icons are pretty, but in some cases can slow down buffer process of data. The setting has effect only if file-icons package is installed, else default atom-icons has been used',
      type: 'boolean',
      default: true,
    },
    autocompletePath: {
      title: "Enable or disable path autocomplete",
      description: 'Enable or disable autocomplete paths in the text editor. To call the hint, type `///` followed by the text that will be searched in the file-list using the fuzzy-finder',
      type: 'boolean',
      default: true,
    },
  },

  activate() {
    this.pathManager     = new PathManager    (this)
    this.pathListView    = new PathListView   (this)
    this.projectListView = new ProjectListView(this)
    this.recentListView  = new RecentListView (this)
  },

  deactivate() {
    this.pathManager    .destroy()
    this.pathListView   .destroy()
    this.projectListView.destroy()
    this.recentListView .destroy()
  },

  consumeElementIcons(func) {
    this.addIconToElement = func;
  },

  consumeClassIcons(object) {
    this.getIconClass = object.iconClassForPath;
  },

  getProvider() {
    return new PathProvider(this)
  },
}
