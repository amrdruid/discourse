import { default as computed, observes } from "ember-addons/ember-computed-decorators";
import { ajax } from 'discourse/lib/ajax';

export default Ember.Component.extend({
  layoutName: 'components/discourse-poll',
  classNames: ["poll"],
  attributeBindings: ["data-poll-type", "data-poll-name", "data-poll-status", "data-poll-public"],

  "data-poll-type": Ember.computed.alias("poll.type"),
  "data-poll-name": Ember.computed.alias("poll.name"),
  "data-poll-status": Ember.computed.alias("poll.status"),
  "data-poll-public": Ember.computed.alias("poll.public"),

  isMultiple: Ember.computed.equal("poll.type", "multiple"),
  isNumber: Ember.computed.equal("poll.type", "number"),
  isClosed: Ember.computed.equal("poll.status", "closed"),
  isPublic: Ember.computed.equal("poll.public", "true"),

  // shows the results when
  //   - poll is closed
  //   - topic is archived
  //   - user wants to see the results
  showingResults: Ember.computed.or("isClosed", "post.topic.archived", "showResults"),

  showResultsDisabled: Ember.computed.equal("poll.voters", 0),
  hideResultsDisabled: Ember.computed.or("isClosed", "post.topic.archived"),

  @observes("post.polls")
  _updatePoll() {
    this.set("model", this.get("post.pollsObject")[this.get("model.name")]);
  },

  @computed("poll.options.@each.selected")
  selectedOptions() {
    return _.map(this.get("poll.options").filterBy("selected"), o => o.get("id"));
  },

  @computed("poll.voters")
  votersText(count) {
    return I18n.t("poll.voters", { count });
  },

  @computed("poll.options.@each.votes")
  totalVotes() {
    return _.reduce(this.get("poll.options"), function(total, o) {
      return total + parseInt(o.get("votes"), 10);
    }, 0);
  },

  @computed("totalVotes")
  totalVotesText(count) {
    return I18n.t("poll.total_votes", { count });
  },

  @computed("min", "max", "poll.options.length")
  multipleHelpText(min, max, options) {
    if (max > 0) {
      if (min === max) {
        if (min > 1) {
          return I18n.t("poll.multiple.help.x_options", { count: min });
        }
      } else if (min > 1) {
        if (max < options) {
          return I18n.t("poll.multiple.help.between_min_and_max_options", { min, max });
        } else {
          return I18n.t("poll.multiple.help.at_least_min_options", { count: min });
        }
      } else if (max <= options) {
        return I18n.t("poll.multiple.help.up_to_max_options", { count: max });
      }
    }
  },

  @computed("isClosed", "showResults", "loading", "isMultiple", "selectedOptions.length", "min", "max")
  canCastVotes(isClosed, showResults, loading, isMultiple, selectedOptionCount, min, max) {
    if (isClosed || showResults || loading) {
      return false;
    }

    if (isMultiple) {
      return selectedOptionCount >= min && selectedOptionCount <= max;
    } else {
      return selectedOptionCount > 0;
    }
  },

  castVotesDisabled: Em.computed.not("canCastVotes"),

  @computed("castVotesDisabled")
  castVotesButtonClass(castVotesDisabled) {
    return `cast-votes ${castVotesDisabled ? '' : 'btn-primary'}`;
  },

  @computed("loading", "post.user_id", "post.topic.archived")
  canToggleStatus(loading, userId, topicArchived) {
    return this.currentUser &&
           (this.currentUser.get("id") === userId || this.currentUser.get("staff")) &&
           !loading &&
           !topicArchived;
  },

  actions: {

    castVotes() {
    },

    toggleResults() {
      this.toggleProperty("showResults");
    },

    toggleStatus() {
      if (!this.get("canToggleStatus")) { return; }

      const self = this,
            confirm = this.get("isClosed") ? "poll.open.confirm" : "poll.close.confirm";

      bootbox.confirm(
        I18n.t(confirm),
        I18n.t("no_value"),
        I18n.t("yes_value"),
        function(confirmed) {
          if (confirmed) {
            self.set("loading", true);

            ajax("/polls/toggle_status", {
              type: "PUT",
              data: {
                post_id: self.get("post.id"),
                poll_name: self.get("poll.name"),
                status: self.get("isClosed") ? "open" : "closed",
              }
            }).then(results => {
              self.set("model", Em.Object.create(results.poll));
            }).catch(() => {
              bootbox.alert(I18n.t("poll.error_while_toggling_status"));
            }).finally(() => {
              self.set("loading", false);
            });
          }
        }
      );

    },
  }

});
