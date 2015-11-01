/*jslint browser: true */
/*global define*/
define([
	'handlebars',
	'views/BaseView',
	'utils/logger',
	'utils/ShorelineUtil',
	'views/ShorelineColumnMatchingView',
	'underscore',
	'views/ModalWindowView',
	'models/ModalModel',
	'text!templates/shoreline-management-view.html'
], function (Handlebars, BaseView, log, ShorelineUtil, ColumnMatchingView, _, ModalWindowView, ModalModel, template) {
	"use strict";
	var view = BaseView.extend({
		events: {
			'click #button-shorelines-file-select': 'handleFileSelectClick',
			'click #button-shorelines-upload': 'handleUploadButtonClick',
			'change #input-shorelines-file': 'handleUploadContentChange'
		},
		SHORELINE_STAGE_ENDPOINT: 'service/stage-shoreline',
		template: Handlebars.compile(template),
		initialize: function (options) {
			BaseView.prototype.initialize.apply(this, [options]);
			log.debug("DSASweb Shoreline management view initializing");
			return this;
		},
		render: function (options) {
			options = options || {};
			BaseView.prototype.render.apply(this, [options]);
			$(this.el).appendTo(options.el);
			return this;
		},
		handleFileSelectClick: function () {
			this.$('#input-shorelines-file').click();
		},
		handleUploadButtonClick: function () {
			var file = document.getElementById('input-shorelines-file').files[0],
					xhr = new XMLHttpRequest(),
					workspace = localStorage.dsas;

			var formData = new FormData();
			formData.append("file", file);

			xhr.upload.addEventListener("progress", function (e) {
				if (e.lengthComputable) {
					var percentage = Math.round((e.loaded * 100) / e.total);
					log.info(percentage);
				}
			}, false);

			xhr.onreadystatechange = function (e) {
				var status = e.currentTarget.status,
						readyState = e.currentTarget.readyState,
						responseString = e.currentTarget.response,
						response,
						token;

				if (readyState === 4 && responseString) {
					switch (status) {
						case 200:
							response = JSON.parse(responseString);
							token = response.token;
							this.scope.handleFileStaged(token);
							break;
						case 404:
							break;
						case 500:
							break;
					}
					this.scope.$('#container-shorelines-file-info').addClass('hidden');
				}
			};

			xhr.scope = this;
			xhr.open("POST", this.SHORELINE_STAGE_ENDPOINT + "?action=stage&workspace=" + workspace, true);
			xhr.send(formData);
			return xhr;
		},
		/**
		 * 
		 * @param {type} e
		 * @returns {File}
		 */
		handleUploadContentChange: function (e) {
			var chosenFile = e.target.files[0],
					name = chosenFile.name,
					size = chosenFile.size,
					$infoContainer = this.$('#container-shorelines-file-info'),
					$nameContainer = this.$('#container-shorelines-file-info-filename'),
					$sizeContainer = this.$('#container-shorelines-file-info-filesize');

			$infoContainer.addClass('hidden');

			if (!name.endsWith(".zip")) {
				// TODO - Display alert
				log.debug("Not a zip");

			} else if (size > Number.MAX_VALUE) {
				// TODO - Figure out intelligent max size for a file
				log.debug("File too large");
			} else {
				// Update the info container with file information
				$nameContainer.html(name);
				$sizeContainer.html(size);
				$infoContainer.removeClass('hidden');
			}
			return chosenFile;
		},
		handleFileStaged: function (token) {
			ShorelineUtil.getShorelineHeaderColumnNames(token)
					.done($.proxy(function (response) {
						var headers = response.headers.split(","),
								foundAllRequiredColumns = false,
								// Returns an object with headers for keys and blank strings 
								// for values: {'a': '', 'b': '', 'c': ''}
								layerColumns = _.object(headers, Array.apply(null, Array(headers.length))
										.map(function () {
											return '';
										}));

						if (headers.length < ShorelineUtil.MANDATORY_COLUMNS.length) {
							log.warn('Shorelines.js::addShorelines: There ' +
									'are not enough attributes in the selected ' +
									'shapefile to constitute a valid shoreline. ' +
									'Will be deleted. Needed: ' +
									ShorelineUtil.MANDATORY_COLUMNS.length +
									', Found in upload: ' + headers.length);
						} else {
							layerColumns = ShorelineUtil.createLayerUnionAttributeMap({
								layerColumns: layerColumns
							});

							// Do we have all the columns we need?
							_.each(ShorelineUtil.MANDATORY_COLUMNS, function (mc) {
								if (_.values(layerColumns).indexOf(mc) === -1) {
									foundAllRequiredColumns = false;
								}
							}, this);

							_.each(ShorelineUtil.DEFAULT_COLUMNS, function (col) {
								if (_.values(layerColumns).indexOf(col.attr) === -1) {
									foundAllRequiredColumns = false;
								}
							}, this);

							if (!foundAllRequiredColumns) {
								// User needs to match columns 
								var columnMatchingView = new ColumnMatchingView({
									parent: this,
									router: this.router,
									appEvents: this.appEvents,
									layerColumns: layerColumns
								}),
								modalView = new ModalWindowView({
									model : new ModalModel({
										title : 'Column Information Required',
										view : columnMatchingView,
										autoShow : true
									})
								}).render();
								
							} else {
								var importDeferred = ShorelineUtil.importShorelineFromToken({
									token: token,
									workspace: localStorage.dsas,
									layerColumns: layerColumns
								});
								// TODO
							}

						}
					}, this))
					.fail(function () {
						// TODO
					});
		}
	});

	return view;
});