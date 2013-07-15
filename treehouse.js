(function($){
	$.fn.treehouse = function(options) {

		//underscore Shim
		var _ = _ || {
			extend : function(obj1, obj2){
				for(var propName in obj2){
					if(obj2.hasOwnProperty(propName)){ obj1[propName] = obj2[propName]; }
				}
				return obj1;
			},
			each : function(obj, fn){
				for(var propName in obj){
					if(obj.hasOwnProperty(propName)){ fn(obj[propName], propName); }
				}
			},
			map : function(obj, fn){
				var result = []
				for(var propName in obj){
					if(obj.hasOwnProperty(propName)){ result.push(fn(obj[propName], propName)); }
				}
				return result;
			},
			reduce : function(obj, fn, memo){
				for(var propName in obj){
					if(obj.hasOwnProperty(propName)){ memo = fn(memo, obj[propName], propName); }
				}
				return memo;
			}
		};

		//Basic events and prototypical inheritance
		var BaseObj = {
			initialize : function(){
				return this;
			},
			methods : function(methods){
				for(var methodName in methods){
					this[methodName] = methods[methodName];
				}
				return this;
			},
			on : function(eventName, event){
				if(!this.__events__){ this.__events__ = {};}
				if(!this.__events__[eventName]){this.__events__[eventName] = [];}
				this.__events__[eventName].push(event);
			},
			trigger : function(eventName){
				if(!this.__events__){ this.__events__ = {};}
				if(this.__events__[eventName]){
					for(var i = 0; i < this.__events__[eventName].length; i++) {
						this.__events__[eventName][i].apply(this, Array.prototype.slice.apply(arguments).slice(1));
					}
				}
			}
		};

		var Tree = Object.create(BaseObj).methods({
			initialize : function(container, options)
			{
				this.fixedMargin = false;
				this.dom = {
					block : container
				};
				this.nodes = [];

				var defaultOptions = {
					indent_length                             : 30,
					expand_icon                               : '+',
					collapse_icon                             : '-',
					animation_time                            : 300,
					expanded                                  : true,
					child_updates_parent                      : true,
					parent_selects_children                   : true,
					checked_parent_must_have_checked_children : true,
					click_to_expand                           : true,
					click_to_check                            : true
				};
				this.options = _.extend(defaultOptions, options);
				return this;
			},

			build : function(dataJson)
			{
				var self = this;
				this.dom.block.html('');
				this.nodes = [];
				_.each(dataJson, function(node){
					var newNode = Object.create(Node).initialize(self.options, node, self.dom.block, 0);
					newNode.on('update', function(node){
						self.trigger('update', node);
					});
					newNode.on('hover', function(node){
						self.trigger('hover', node);
					});
					newNode.on('click', function(node){
						self.trigger('click', node);
					});

					newNode.on('render', function(expandWidth, collaspeWidth){
						if(self.fixedMargin){ return; }
						var max = (expandWidth > collaspeWidth) ? expandWidth : collaspeWidth;

						self.dom.block.css('margin-left', parseInt(self.dom.block.css('margin-left'),10) + max);
						self.fixedMargin = true;
					});

					self.nodes.push(newNode);
				});

				return this;
			},

			reduce : function(fn, memo)
			{
				return _.reduce(this.nodes, function(memo, node){
					return node.reduce(fn, memo);
				}, memo);
			},

			get : function(id)
			{
				return this.reduce(function(result, node){
					if(node.id === id){
						result = node;
					}
					return result;
				}, undefined);
			},

			each : function(fn)
			{
				_.each(this.nodes, function(node){
					node.each(fn);
				});
				return this;
			},

			update  : function(fn)
			{
				this.on('update', fn);
				return this;
			},

			toJSON : function()
			{
				return _.map(this.nodes, function(node){
					return node.toJSON();
				});
			}
		});

		var Node = Object.create(BaseObj).methods({
			initialize : function(options, data, container, layer)
			{
				var self = this;
				this._checked = false;
				this.nodes = [];
				this.options = options;

				this.dom = {
					block : $(self.getSchematic()).appendTo(container)
				};

				this.dom.label      = this.dom.block.find('.treehouse-label');
				this.dom.checkbox   = this.dom.block.find('.treehouse-checkbox');
				this.dom.expand     = this.dom.block.find('.treehouse-expand');
				this.dom.collapse   = this.dom.block.find('.treehouse-collapse');
				this.dom.container  = this.dom.block.find('.treehouse-nodecontainer');

				if(data.checked){
					this._checked = true;
					this.dom.checkbox[0].checked = true;
				}

				this.layer = layer;
				this.id = data.id;
				this.label = data.label;
				this.$el = this.dom.block;
				this.dom.label.html(data.label);
				this.dom.checkbox.attr('name', this.id);
				this.dom.block.attr('id', this.id);
				this.dom.block.addClass('treehouse-layer' + layer);

				this.createNodes(data);
				this.setupStyle(data);
				this.setupEvents();
				return this;
			},

			createNodes : function(data)
			{
				var self = this;
				_.each(data.nodes, function(node){
					var newChild = Object.create(Node).initialize(self.options, node, self.dom.container, self.layer + 1);

					newChild.on('update', function(node){
						if(self.isChecked() && !self.hasCheckedChild() && self.options.checked_parent_must_have_checked_children){
							self.uncheck();
						}
						self.trigger('update', node);
					});
					newChild.on('hover', function(node){
						self.trigger('hover', node);
					});
					newChild.on('click', function(node){
						self.trigger('click', node);
					});

					//event: child_updates_parent
					if(self.options.child_updates_parent === true){
						newChild.on('check', function(){
							self.check({silent:true});
							self.trigger('check:auto', self);
						});
						newChild.on('check:auto', function(){
							self.check({silent:true});
							self.trigger('check:auto', self);
						});
					}
					self.nodes.push(newChild);
				});
				return this;
			},

			setupEvents : function()
			{
				var self = this;
				this.dom.expand.click(function(){
					self.expand();
				});

				this.dom.collapse.click(function(){
					self.collapse();
				});
				this.dom.label.click(function(){
					if(self.options.click_to_expand && self.nodes.length > 0){
						if(self._expanded){
							self.collapse();
						} else {
							self.expand();
						}
					} else if(self.options.click_to_check) {
						self.toggle();
					}

				});

				this.dom.checkbox.change(function(){
					if(self.dom.checkbox[0].checked){
						self.check();
					} else {
						self.uncheck();
					}
				});

				//event: parent_selects_children
				if(self.options.parent_selects_children === true){
					this.on('check', function(){
						_.each(self.nodes, function(node){
							node.check({force:true});
						});
					});
					this.on('uncheck', function(){
						_.each(self.nodes, function(node){
							node.uncheck({force:true});
						});
					});
				}

				return this;
			},

			setupStyle : function(data)
			{
				var self = this;
				this.dom.label.css({
					cursor : 'pointer'
				});

				this.dom.collapse.html(this.options.collapse_icon);
				this.dom.expand.html(this.options.expand_icon);

				if(typeof this.id === 'undefined'){
					this.dom.checkbox.hide();
				}

				this.dom.container.css({
					'margin-left' : self.options.indent_length  + 'px'
				});

				if(!this.hasChildren()){
					this.dom.container.hide();
					this.dom.expand.hide();
					this.dom.collapse.hide();
				}

				//Wait a bit to let the buttons render
				setTimeout(function(){
					self.dom.collapse.css({
						cursor         : 'pointer',
						'margin-left' : (-1 * self.dom.collapse.outerWidth()) + 'px'
					});
					self.dom.expand.css({
						cursor         : 'pointer',
						'margin-left' : (-1* self.dom.expand.outerWidth()) + 'px'
					});
					self.trigger('render', self.dom.expand.outerWidth(), self.dom.collapse.outerWidth());

					if(data.expanded === false || (typeof data.expanded === 'undefined' && !self.options.expanded)){
						self.collapse(true);
					} else {
						self.expand(true);
					}
				},100);


				return this;
			},

			toggle : function(opts)
			{
				if(this.isChecked()){
					this.uncheck(opts);
				} else {
					this.check(opts);
				}
				return this;
			},

			check : function(opts)
			{
				opts = opts || {};
				if(!this._checked || opts.force){
					this.dom.checkbox[0].checked = true;
					this._checked = true;
					if(opts.silent){
						return this;
					}
					this.trigger('update', this);
					this.trigger('check', this);
				}

				return this;
			},

			uncheck : function(opts)
			{
				opts = opts || {};
				if(this._checked || opts.force){
					this.dom.checkbox[0].checked = false;
					this._checked = false;
					if(opts.silent){
						return this;
					}
					this.trigger('update', this);
					this.trigger('uncheck', this);
				}
				return this;
			},

			isChecked : function()
			{
				return this._checked;
			},

			expand : function(doNotUseAnimations)
			{
				if(this.hasChildren() && (!this._expanded || typeof this._expanded === 'undefined')){
					this.dom.expand.hide();
					this.dom.collapse.show();
					if(doNotUseAnimations){
						this.dom.container.show();
					} else {
						this.dom.container.slideDown(this.options.animation_time);
					}
					this._expanded = true;
					this.trigger('expand', this);
				}
				return this;
			},

			collapse : function(doNotUseAnimations)
			{
				if(this.hasChildren() && (this._expanded || typeof this._expanded === 'undefined')){
					this.dom.expand.show();
					this.dom.collapse.hide();
					if(doNotUseAnimations){
						this.dom.container.hide();
					} else {
						this.dom.container.slideUp(this.options.animation_time);
					}
					this._expanded = false;
					this.trigger('collapse', this);
				}
				return this;
			},

			hasChildren : function()
			{
				return this.nodes.length > 0;
			},

			toJSON : function()
			{
				var result = {
					label : this.label
				};
				var nodes = _.map(this.nodes, function(node){
					return node.toJSON();
				});
				if(this.id){
					result.id = this.id;
					result.checked = this.isChecked();
				}
				if(nodes.length > 0){
					result.nodes = nodes;
					result.expanded = this._expanded;
				}
				return result;
			},

			get : function(id)
			{
				if(id === this.id){
					return this;
				}
				return _.reduce(this.nodes, function(result, node){
					return node.get(id) || result;
				}, undefined);
			},

			each : function(fn)
			{
				fn(this);
				_.each(this.nodes, function(node){
					node.each(fn);
				});
				return this;
			},

			reduce : function(fn, memo)
			{
				memo = fn(memo, this);
				return _.reduce(this.nodes, function(memo, node){
					return node.reduce(fn, memo);
				}, memo);
			},

			hasCheckedChild : function()
			{
				if(this.nodes.length === 0){
					return false;
				}
				return _.reduce(this.nodes, function(result, node){
					if(node.isChecked()){
						return true;
					} else {
						return node.hasCheckedChild() || result;
					}
				},false);
			},

			getSchematic : function()
			{
				return '<div class="treehouse-node"><div class="treehouse-title"><span class="treehouse-collapse"></span><span class="treehouse-expand"></span><input class="treehouse-checkbox" type="checkbox"><span class="treehouse-label"></span></div><div class="treehouse-nodecontainer"></div></div>';
			}
		});

		return Object.create(Tree).initialize($(this), options);

	};
})(jQuery);
