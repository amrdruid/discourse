import { createWidget } from 'discourse/widgets/widget';
import { h } from 'virtual-dom';
import { iconNode } from 'discourse/helpers/fa-icon-node';
import RawHtml from 'discourse/widgets/raw-html';
import { ajax } from 'discourse/lib/ajax';

createWidget('discourse-poll-option', {
  tagName: 'li',

  buildAttributes(attrs) {
    return { 'data-poll-option-id': attrs.option.id };
  },

  html(attrs) {
    const result = [];

    const { option } = attrs;
    const selected = option.selected;
    if (attrs.isMultiple) {
      result.push(iconNode(selected ? 'check-square-o' : 'square-o'));
    } else {
      result.push(iconNode(selected ? 'dot-circle-o' : 'circle-o'));
    }
    result.push(' ');
    result.push(new RawHtml({ html: `<span>${option.html}</span>` }));
    return result;
  },

  click(e) {
    if ($(e.target).closest("a").length === 0) {
      this.sendWidgetAction('toggleOption', this.attrs.option);
    }
  }
});

createWidget('discourse-poll-container', {
  tagName: 'div.poll-container',
  html(attrs) {
    const { poll } = attrs;
    const options = poll.get('options');

    if (options) {
      return h('ul', options.map(option => {
        return this.attach('discourse-poll-option', { option, isMultiple: attrs.isMultiple });
      }));
    }
  }
});

export default createWidget('discourse-poll', {
  tagName: 'div.poll',
  buildKey: attrs => attrs.id,

  defaultState() {
    return { loading: false,
             showResults: false };
  },

  html(attrs) {
    return h('div', [this.attach('discourse-poll-container', attrs)]);
  },

  selectedOptionIds() {
    return this.attrs.poll.get('options').filter(o => o.selected).map(o => o.id);
  },

  isClosed() {
    return this.attrs.poll.get('status') === "closed";
  },

  min() {
    let min = parseInt(this.attrs.poll.min, 10);
    if (isNaN(min) || min < 1) { min = 1; }
    return min;
  },

  max() {
    let max = parseInt(this.attrs.poll.max, 10);
    const numOptions = this.attrs.poll.options.length;
    if (isNaN(max) || max > numOptions) { max = numOptions; }
    return max;
  },

  canCastVotes() {
    const { state, attrs } = this;
    if (this.isClosed() || state.showResults || state.loading) {
      return false;
    }

    const selectedOptionCount = this.selectedOptionIds().length;
    if (attrs.isMultiple) {
      return selectedOptionCount >= this.min() && selectedOptionCount <= this.max();
    }
    return selectedOptionCount > 0;
  },

  showLogin() {
    const appRoute = this.register.lookup('route:application');
    appRoute.send('showLogin');
  },

  toggleOption(option) {
    if (this.isClosed()) { return; }
    if (!this.currentUser) { this.showLogin(); }

    const { attrs } = this;
    const wasSelected = option.selected;

    if (!attrs.isMultiple) {
      attrs.poll.get('options').forEach(o => o.selected = false);
    }
    option.selected = !option.selected;

    console.log('sel', option.selected);
    if (!attrs.isMultiple && !wasSelected) {
      return this.castVotes();
    }
  },

  castVotes() {
    if (!this.canCastVotes()) { return; }
    if (!this.currentUser) { this.showLogin(); }

    const { attrs, state } = this;
    return;

    state.loading = true;

    return ajax("/polls/vote", {
      type: "PUT",
      data: {
        post_id: attrs.post.id,
        poll_name: attrs.poll.name,
        options: this.selectedOptionIds()
      }
    }).then(results => {
      console.log(results);
      // this.setProperties({ vote: votes, showResults: true });
      // this.set("model", Em.Object.create(poll));
    }).catch(() => {
      bootbox.alert(I18n.t("poll.error_while_casting_votes"));
    }).finally(() => {
      state.loading = false;
    });
  }

});
