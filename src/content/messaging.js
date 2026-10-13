const { BROKERAGE_FACTS } = require('./brokerage.js');

const CONSUMER_MESSAGING = {
  homepageHeadline: `Full-service real estate brokerage with direct broker access in ${BROKERAGE_FACTS.serviceArea}.`,
  homepageSubhead: `TD Realty Ohio helps clients buy, sell, and lease homes across ${BROKERAGE_FACTS.serviceArea} with straightforward guidance and hands-on execution.`,
  processSteps: [
    'Consultation and strategy tailored to your goals and timeline',
    'Execution support for showings, offers, negotiations, and paperwork',
    'Contract-to-close coordination with proactive communication'
  ]
};

/*
 * What the brokerage offers an agent, stated as support rather than splits.
 *
 * This was AGENT_COMPENSATION and carried three percentages that were
 * rendered into the /agents/ cards, three FAQ answers, the page's meta
 * description and the route registry's description. Compensation is a
 * conversation to have with the broker, not a number to rank for.
 */
const AGENT_SUPPORT = {
  brokerAccess: 'direct broker availability on live transactions',
  oversight: 'transaction and compliance oversight through closing',
  systems: 'MLS and document workflow support',
  leadership: 'local brokerage leadership without franchise layers'
};

const CTA_TEXT = {
  contactBroker: 'Talk With Travis',
  scheduleConsult: 'Schedule a Consultation',
  discussMove: 'Discuss Your Next Move'
};

module.exports = {
  CONSUMER_MESSAGING,
  AGENT_SUPPORT,
  CTA_TEXT,
};
