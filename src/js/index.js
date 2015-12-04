/*jshint browser: true, jquery: true */
/*global clique, _, tangelo, d3 */

$(function () {
    "use strict";

    var cfg,
        launch;

    launch = function (_cfg) {
        var mongoStore,
            graph,
            view,
            info,
            colormap,
            ungroup,
            linkColormap,
            expandNode;

        cfg = _cfg;

        mongoStore = {
            host: cfg.host || "localhost",
            database: cfg.database,
            collection: cfg.collection
        };

        window.graph = graph = new clique.Graph({
            adapter: new tangelo.plugin.mongo.Mongo(mongoStore)
        });

        ungroup = function (node) {
            var fromLinks,
                toLinks,
                restoredNodes;

            // Get all links involving the group node.
            fromLinks = this.graph.adapter.findLinks({
                source: node.key()
            });

            toLinks = this.graph.adapter.findLinks({
                target: node.key()
            });

            $.when(fromLinks, toLinks).then(_.bind(function (from, to) {
                var inclusion,
                    reqs;

                // Find the "inclusion" links originating from the
                // group node.
                inclusion = _.filter(from, function (link) {
                    return link.getData("grouping");
                });

                // Store the node keys associated to these links.
                restoredNodes = _.invoke(inclusion, "target");

                // Delete all the links.
                reqs = _.map(from.concat(to), _.bind(this.graph.adapter.destroyLink, this.graph.adapter));

                return $.apply($, reqs);
            }, this)).then(_.bind(function () {
                // Remove the node from the graph.
                this.graph.removeNode(node);

                // Delete the node itself.
                return this.graph.adapter.destroyNode(node);
            }, this)).then(_.bind(function () {
                var reqs;

                // Get mutators for the restored nodes.
                reqs = _.map(restoredNodes, this.graph.adapter.findNodeByKey, this.graph.adapter);

                return $.when.apply($, reqs);
            }, this)).then(_.bind(function () {
                var nodes = _.toArray(arguments);

                // Clear the deleted flag from the nodes.
                _.each(nodes, function (node) {
                    node.clearData("deleted");
                }, this);

                // Add the nodes to the graph.
                this.graph.addNodes(nodes);
            }, this));
        };

        $("#submit").on("click", function () {
            var userid = $("#userid").val(),
                spec = {};

            if (userid === "") {
                return;
            }

            spec = {
                twitter_id: userid
            };

            graph.adapter.findNode(spec).then(_.bind(graph.addNode, graph));
        });

        colormap = d3.scale.category10();

        // This is a 3-color categorical colormap from colorbrewer
        // (http://colorbrewer2.org/?type=qualitative&scheme=Paired&n=3) to
        // encode interaction types: mention, reply, and retweet.
        linkColormap = d3.scale.ordinal();
        linkColormap.range(["#a6cee3","#1f78b4","#b2df8a"]);

        window.view = view = new clique.view.Cola({
            model: graph,
            el: "#content",
            label: function (d) {
                return d.data.twitter_id;
            },
            fill: function (d) {
                // Red for propagandists; blue for audience.
                return d.data.type === "propagandist" ? "#ef8a62" : "#67a9cf";
            },
            nodeRadius: function (d, r) {
                return d.data && d.data.grouped ? 2*r : r;
            },
            postLinkAdd: function (s) {
                var cmap = function (d) {
                    return linkColormap(d.data.interaction);
                };

                s.style("fill", cmap)
                    .style("stroke", cmap);
            },
            transitionTime: 500,
            focusColor: "pink",
            rootColor: "gold"
        });

        if (false) {
            (function () {
                var orig = view.renderNodes;

                view.renderNodes = _.bind(function (nodes) {
                    orig(nodes);

                    nodes.each(function (d) {
                        var that = d3.select(this).select("circle");
                        console.log("that", that);
                        graph.adapter.neighborCount(graph.adapter.getAccessor(d.key)).then(function (count) {
                            console.log("count", count);
                            var r = that.attr("r");
                            console.log("r", r);
                            console.log("r after", r + Math.sqrt(count));
                            that.transition()
                                .duration(150)
                                .attr("r", 10 + Math.sqrt(count));
                        });
                    });
                }, view);
            }());
        }

        expandNode = function (node) {
            graph.adapter.neighborhood(node, 1, 10).then(function (nbd) {
                _.each(nbd.nodes, function (n) {
                    graph.addNode(n, nbd.links);
                });
            });
        };

        view.on("render", function () {
            var $cm,
                getMenuPosition;

            $cm = $("#contextmenu");

            // This returns a position near the mouse pointer, unless it is too
            // near the right or bottom edge of the window, in which case it
            // returns a position far enough inside the window to display the
            // menu in question.
            getMenuPosition = function (mouse, direction, scrollDir) {
                var win = $(window)[direction](),
                    scroll = $(window)[scrollDir](),
                    menu = $("#contextmenu")[direction](),
                    position = mouse + scroll;

                if (mouse + menu > win && menu < mouse) {
                    position -= menu;
                }

                return position;
            };

            // Attach a contextmenu action to all the nodes - it populates the
            // menu element with appropriate data, then shows it at the
            // appropriate position.
            d3.select(view.el)
                .selectAll("g.node")
                .on("contextmenu", function (d) {
                    var cm = d3.select("#contextmenu"),
                        ul = cm.select("ul"),
                        node = graph.adapter.getAccessor(d.key),
                        left,
                        def,
                        top;

                    left = getMenuPosition(d3.event.clientX, "width", "scrollLeft");
                    top = getMenuPosition(d3.event.clientY, "height", "scrollTop");

                    ul.select("li.nodelabel")
                        .text(function () {
                            return "ID: " + d.data.twitter_id;
                        });

                    ul.select("a.context-hide")
                        .on("click", _.bind(clique.view.SelectionInfo.hideNode, info, node));

                    ul.select("a.context-expand")
                        .on("click", _.partial(expandNode, node));

                    ul.select("a.context-collapse")
                        .on("click", _.bind(clique.view.SelectionInfo.collapseNode, info, node));

                    ul.select("a.context-ungroup")
                        .style("display", d.data.grouped ? null : "none")
                        .on("click", _.bind(ungroup, info, node));

                    if (cfg.intentService && d.data.usernames) {
                        def = $.getJSON(cfg.intentService, {
                            username: d.data.usernames[0]
                        });
                    } else {
                        def = $.when({});
                    }

                    def.then(function (apps) {
                        apps = _.map(apps, function (data, app) {
                            return _.extend(data, {name: app});
                        });

                        cm.select("ul")
                            .selectAll("li.external")
                            .remove();

                        cm.select("ul")
                            .selectAll("li.external-header")
                            .remove();

                        if (_.size(apps) > 0) {
                            cm.select("ul")
                                .append("li")
                                .classed("external-header", true)
                                .classed("dropdown-header", true)
                                .text("External Applications");

                            cm.select("ul")
                                .selectAll("li.external")
                                .data(apps)
                                .enter()
                                .append("li")
                                .classed("external", true)
                                .append("a")
                                .attr("tabindex", -1)
                                .attr("href", function (d) {
                                    return d.username;
                                })
                                .attr("target", "_blank")
                                .text(function (d) {
                                    return d.name;
                                })
                                .on("click", function () {
                                    $cm.hide();
                                });
                        }

                        $cm.show()
                            .css({
                                left: left,
                                top: top
                            });
                    });
                });

            // Clicking anywhere else will close any open context menu.  Use the
            // mouseup event (bound to only the left mouse button) to ensure the
            // menu disappears even on a selection event (which does not
            // generate a click event).
            d3.select(document.body)
                .on("mouseup.menuhide", function () {
                    if (d3.event.which !== 1) {
                        return;
                    }
                    $cm.hide();
                });
        });
        window.info = info = new clique.view.SelectionInfo({
            model: view.selection,
            graph: graph
        });

        view.selection.on("focused", function (focusKey) {
            var node,
                data;

            if (_.isUndefined(focusKey)) {
                d3.select("#urls-title")
                    .classed("hidden", true);

                d3.select("#times-title")
                    .classed("hidden", true);

                d3.select("#places-title")
                    .classed("hidden", true);

                d3.select("#urls")
                    .selectAll("*")
                    .remove();

                d3.select("#times")
                    .selectAll("*")
                    .remove();

                d3.select("#places")
                    .selectAll("*")
                    .remove();

                return;
            }

            node = graph.adapter.getAccessor(focusKey);

            data = node.getData("propaganda_urls_exposed_to");
            if (data) {
                d3.select("#urls-title")
                    .classed("hidden", false);

                d3.select("#urls")
                    .selectAll("a")
                    .data(data)
                    .enter()
                    .append("a")
                    .attr("href", _.identity)
                    .text(function (d, i) {
                        return "url" + (i+1) + " ";
                    });
            }

            data = node.getData("timestamps_of_propaganda");
            if (data) {
                d3.select("#times-title")
                    .classed("hidden", false);

                d3.select("#times")
                    .selectAll("span")
                    .data(data)
                    .enter()
                    .append("span")
                    .html(function (d) {
                        return new Date(d) + "<br>";
                    });
            }

            data = node.getData("geos");
            if (data) {
                d3.select("#places-title")
                    .classed("hidden", false);

                d3.select("#places")
                    .selectAll("span")
                    .data(data)
                    .enter()
                    .append("span")
                    .html(function (d) {
                        return "(" + d[0] + ", " + d[1] + ")" + "<br>";
                    });
            }
        });

        if (cfg.titan && cfg.graphCentrality) {
            $("button.nodecentrality").on("click", function () {
                var rexster = window.location.origin + ["", "plugin", "mongo", "rexster", "graphs", cfg.database + "," + cfg.collection].join("/");

                $.getJSON("assets/tangelo/romanesco/degree_centrality/workflow", {
                    sourceGraph: rexster,
                    titan: cfg.titan
                }).then(function (result) {
                    console.log(result);
                });
            });
        } else {
            d3.selectAll(".nodecentrality")
                .remove();
        }

        $("#textmode").on("click", function () {
            view.toggleLabels();
        });

        // Process the query arguments.
        var args = tangelo.queryArguments();

        // If a node is requested in the query arguments, look for it and add it
        // if found.
        if (_.has(args, "id")) {
            graph.adapter.findNode({
                twitter_id: args.id
            }).then(function (node) {
                if (node) {
                    graph.addNode(node);
                    expandNode(node);
                }
            });
        }
    };

    $.getJSON("config.json")
        .then(launch, _.bind(launch, {}));
});
