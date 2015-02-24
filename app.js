// First things first -- let's set up our 
// Parse keys for our database backend.
// You can copy these from the Parse docs
// when logging into your account.
$.ajaxSetup({
  headers: {
    "X-Parse-Application-Id" : "K4zLqJj9DKABboTYQLeVyeQVBlhqOtJO7CrTQIEq",
    "X-Parse-REST-API-Key" : "Y7V0uUBdUqCe9sVMx1ZWEkllLDgxaJtp5tYCoTa7"
  }
});


/**
 * Now we'll declare our model. We're using a single
 * model here to represent each stored link. There are 3 
 * important details to note:
 *   1) We have to set 'idAttribute' value for database
 *      sync to work correctly. 
 *   2) Because we're using an Array for one of our 
 *      values, we have to return our _.defaults() as
 *      a function.
 *   3) To make the function work, we have verify that
 *      an object is passed in the "attributes" variable.
 *      We do that with the "attributes or empty object" 
 *      check.
**/ 
var Link = Backbone.Model.extend({
  idAttribute: 'objectId',

  defaults: function(attributes) {
    attributes = attributes || {};
    return _.defaults( {

    title: 'default',
    url: 'default',
    description: 'default',
    tags: ['default']
  });
  }
});


/**
 * Next is our collection. This one's pretty simple.
 * We have to use "parse" (the function) because Parse
 * (the server) returns its results wrapped in an outer
 * object.
 * getTags() here returns a deduped array of all the tags 
 * on all the items in our database. This is best served 
 * from our data layaer, so it's been moved here from its
 * original home in the TagListView.
 * getTags() will return "[ ]" if you've forgotten to 
 * .fetch() the collection, so be careful! 
**/
var Links = Backbone.Collection.extend({
  model: Link,
  url: 'https://api.parse.com/1/classes/Bookmarks',
  parse: function(response) { return response.results; },
  getTags: function() {
    var tags = this.pluck('tags');
    return _.chain(tags)
            .flatten()
            .uniq()
            .value();
  }
});


/**
 * Our first view will be a single list item representing
 * a Link model. No magic here. If you're confused by a 
 * particular item, go take a look at the Backbone docs and
 * see if they help you clear things up.
 * Remember that this view will require a Link model to be 
 * set on it before it will render. You'll do this when you 
 * instantiate the view in your router later on.
**/
var LinkView = Backbone.View.extend({
  template: _.template($('#link-template').text()),
  tagName: 'li',
  render: function() {
    this.$el.html(this.template(this.model.toJSON()));
    return this;
  }
});


/**
 * Next up, we'll declare a view that simply lists all our 
 * bookmarks. This view will require a collection and will 
 * render a new LinkView list item to itself for each model
 * in the collection. 
**/
var LinkListView = Backbone.View.extend({
  tagName: 'ul',
  className: 'links-list',
  initialize: function() {
    // We want the list to update whenever we change our collection.
    // This will throw a "_listenId" error if you forget to assign a
    // collection to the instance when you instantiate it. 
    this.listenTo(this.collection, "add sync destroy", this.render);
  },
  render: function() {
    var elements = []; // <-- elements array prevents unecessary DOM hits 
                       //     inside loops. Instead, only append to DOM
                       //     once, when your content has been established.
    this.collection.each(function(item) {
      var newLink = new LinkView({model: item});
      newLink.render();
      elements.push(newLink.el); //<-- This is where we'd normally .append().
    });
    this.$el.html(elements);
    return this;
  }
});


/**
 * This view will provide a small form where users can
 * enter a new bookmark. Internally, it takes the values of
 * its inputs and saves them to a model object that then gets
 * saved to the main app collection. Backbone handles the saving
 * process, so all we need to do is fire off ".create()" on the collection.
 * Woohoo!
**/
var InsertLinkView = Backbone.View.extend({
  tagName: 'form',
  className: 'new-link',
  template: _.template($('#new-link-template').text()),
  events: {
    'submit' : 'makeNewLink'  
  },
  makeNewLink: function(e) {
    // Prevent page blink...
    e.preventDefault();
    // And make new object on our collection,
    // using the values from our inputs.
    this.collection.create({
      title: this.$('.link-title').val(),
      url: this.$('.link-url').val(),
      description: this.$('.link-description').val(),
      tags: this.$('.link-tags').val().split(' ')
    });
    // I could reset each item manually instead of doing this,
    // but this is less code. 
    this.$('input').val('');
    this.$('textarea').val('');
    this.$('input[type="submit"]').val('Submit');
  },
  render: function() {
    // Note that the empty object here is optional.
    // Adding it helps me remember how templates work,
    // but you can just do 'this.template()' too.
    this.$el.html(this.template({}));
    return this;
  }  
});

/**
 * Now we're getting into more complex territory, but only
 * slightly. We need to display all the tags from our links, 
 * and we need them to be links themselves. There are a couple
 * challenges here: 
 *  - Do we use a template or just inline HTML?
 *  - How do we handle duplicate tags?
 *  - Do tags represent a state or just a filter (or both)?
 * For our purposes, we'll let tags represent an application
 * state, so they'll have their own routes. We'll implement the
 * routing later, so for now let's just get the tags, de-duplicate
 * them and write them out to an element. I'll just use a div.
**/
var TagsView = Backbone.View.extend({
  className: 'tags',
  template: _.template($('#tag-view').text()),
  initialize: function() {
    // We want this view to update dynamically as well, so we set
    // a listener on it. 
    this.listenTo(this.collection, 'add destroy sync', this.render);
  },
  render: function() {
    var elements = [],
        self = this;
    // We get all our tags from the collection, then render them 
    // each out to the element. We aggregate our tags in an array
    // again to minimize our DOM calls. 
    this.collection.getTags().forEach(function(tag) {
      elements.push(self.template({tag: tag}));
    });
    this.$el.html(elements);
    return this;
  }
});

/**
 * Our final view will provide the simplest service of all:
 * a count of the total links in our collection. 
**/
var HeaderView = Backbone.View.extend({
  template: _.template($('#count-header').text()),
  initialize: function() {
    this.listenTo(this.collection, "add sync destroy", this.render);
  },
  render: function() {
    var count = this.collection.length;
    this.$el.html(this.template({num:count}));
    return this;
  }
}); 

/**
 * Now we have all the views we need for our app. However, 
 * we don't have them running on a robust Backbone Router!
 * The Router acts as a controller for passing data where
 * it needs to go and for setting easily-reachable URLs
 * that reference application state(s). 
 * For our app, we'll have two routes: an index (main) route,
 * and a "tags" route that takes us directly to a filtered
 * listing of links.
**/
var AppRouter = Backbone.Router.extend({
  routes: {
    '': 'index',
    'tags/:tag' : 'sortByTag'
  },
  initialize: function() {
    // DOM lookups take a lot of extra power!
    // Minimize by saving frequently-used elements
    // as variables.
    this.$container = $('#container');
    this.links = new Links();
    this.header = new HeaderView({collection: this.links});
    this.linkList = new LinkListView({collection: this.links});
    this.linkForm = new InsertLinkView({collection: this.links});
    this.tagsView = new TagsView({collection: this.links});
  },
  // Grab all the links, render them all out
  index: function() {
    var self = this; 
    this.links.fetch().done(function() {
      self.renderAll();
    });
  },
  // Grab all the links, but then use Collection.reset()
  // to filter them by a tag name (given in the URL)
  sortByTag: function(tag) {
    var self = this;
    this.links.fetch().done(function(data) {
      // This looks nasty, but reads like so: 
      //   "Get all links, filter them by the tag requested, 
      //   "and reset self.links' value to the filtered links only." 
      self.links.reset(self.links.filter(function(m) { return m.get('tags').indexOf(tag) !== -1 }));
      self.renderAll();
      // This hardcoded link lets me go back to my
      // index view. This is not a best practice, but
      // works well-enough for this app. 
      self.$container.append('<a href="#">BACK</a>');
    }); 
  },
  // Helper function to render all my elements.
  // For my app, I chose to show the same views
  // on every page and just modify the data given.
  renderAll: function() {
    this.$container.empty();
    this.header.render();
    this.linkList.render();
    this.linkForm.render();
    this.tagsView.render();
    this.$container.html(this.header.el);
    this.$container.append(this.linkList.el);
    this.$container.append(this.tagsView.el);
    this.$container.append(this.linkForm.el);

  }
});


/**
 * As always, we have to instantiate our router
 * and call our history.start() to make it tick.
**/
$(document).ready(function() {
   this.router = new AppRouter();
   Backbone.history.start();
});


/**
 * ALL DONE!
 * Now it's up to you to add styling
 * and make it your own!
 * I hope this was helpful!
 * Feel free to message me @ADotMartin on Twitter
 * if you need any clarification!
**/
