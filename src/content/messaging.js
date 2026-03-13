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

const AGENT_COMPENSATION = {
  listingSide: '100% on listing sides',
  buySide: '90/10 split on buy sides',
  rental: "25% of the first month’s lease on rental transactions"
};

const CTA_TEXT = {
  contactBroker: 'Talk With Travis',
  scheduleConsult: 'Schedule a Consultation',
  discussMove: 'Discuss Your Next Move'
};

module.exports = {
  CONSUMER_MESSAGING,
  AGENT_COMPENSATION,
  CTA_TEXT,
};
