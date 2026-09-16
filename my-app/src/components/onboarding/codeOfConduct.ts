export type ConductBlock = { type: "paragraph"; text: string } | { type: "check"; id: string; text: string; nested?: boolean };
export type ConductSection = { id: string; title: string; blocks: ConductBlock[] };
export const CONDUCT_SECTIONS: ConductSection[] = [
  {
    "id": "confidentiality",
    "title": "Confidentiality and protection of project information",
    "blocks": [
      {
        "type": "paragraph",
        "text": "All interns, volunteers, and contributors at Fluke Games are entrusted with access to proprietary, confidential, and unpublished information. This includes technical, creative, strategic, and operational materials related to ongoing or planned projects."
      },
      {
        "type": "paragraph",
        "text": "All such information must be treated as strictly confidential at all times."
      },
      {
        "type": "check",
        "id": "confidentiality-1",
        "text": "No project material may be shared externally under any circumstances without explicit authorization.",
        "nested": false
      },
      {
        "type": "check",
        "id": "confidentiality-2",
        "text": "This applies to all formats and mediums, including but not limited to:",
        "nested": false
      },
      {
        "type": "check",
        "id": "confidentiality-3",
        "text": "Screenshots or screen recordings",
        "nested": true
      },
      {
        "type": "check",
        "id": "confidentiality-4",
        "text": "Videos or gameplay footage",
        "nested": true
      },
      {
        "type": "check",
        "id": "confidentiality-5",
        "text": "Source code, scripts, or technical implementations",
        "nested": true
      },
      {
        "type": "check",
        "id": "confidentiality-6",
        "text": "Design documents, concept art, or assets",
        "nested": true
      },
      {
        "type": "check",
        "id": "confidentiality-7",
        "text": "Builds, prototypes, or internal tools",
        "nested": true
      },
      {
        "type": "check",
        "id": "confidentiality-8",
        "text": "Internal discussions, chats, meetings, or documentation",
        "nested": true
      },
      {
        "type": "check",
        "id": "confidentiality-9",
        "text": "Work-in-progress content of any kind",
        "nested": true
      },
      {
        "type": "paragraph",
        "text": "Before sharing any project-related content for educational purposes, portfolios, presentations, publications, social media, or public discussions, contributors must obtain prior written approval from their assigned manager or project lead."
      },
      {
        "type": "paragraph",
        "text": "Unauthorized disclosure, duplication, or distribution of confidential information may be considered a violation of Non-Disclosure obligations and may result in serious consequences, including but not limited to:"
      },
      {
        "type": "check",
        "id": "confidentiality-10",
        "text": "Immediate termination of the internship or volunteer engagement",
        "nested": false
      },
      {
        "type": "check",
        "id": "confidentiality-11",
        "text": "Revocation of access to repositories, tools, platforms, and internal systems",
        "nested": false
      },
      {
        "type": "check",
        "id": "confidentiality-12",
        "text": "Withholding or revocation of experience letters, completion certificates, or references",
        "nested": false
      },
      {
        "type": "check",
        "id": "confidentiality-13",
        "text": "Potential legal action under applicable intellectual property, confidentiality, and contract laws",
        "nested": false
      },
      {
        "type": "paragraph",
        "text": "These measures exist to protect the integrity of Fluke Games’ projects, collaborators, and contributors."
      }
    ]
  },
  {
    "id": "respect",
    "title": "Respectful conduct and anti-harassment",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Fluke Games is committed to fostering a safe, inclusive, respectful, and professional environment for all individuals, regardless of role, background, or identity."
      },
      {
        "type": "paragraph",
        "text": "Harassment of any form is strictly prohibited. This includes, but is not limited to:"
      },
      {
        "type": "check",
        "id": "respect-1",
        "text": "Verbal, written, visual, or physical harassment",
        "nested": false
      },
      {
        "type": "check",
        "id": "respect-2",
        "text": "Sexual harassment, inappropriate comments, jokes, gestures, or advances",
        "nested": false
      },
      {
        "type": "check",
        "id": "respect-3",
        "text": "Unwelcome behavior or communication",
        "nested": false
      },
      {
        "type": "check",
        "id": "respect-4",
        "text": "Discrimination or harassment based on gender, gender identity, sexual orientation, religion, caste, ethnicity, nationality, disability, or any other protected characteristic",
        "nested": false
      },
      {
        "type": "paragraph",
        "text": "Such behavior will not be tolerated under any circumstances."
      },
      {
        "type": "paragraph",
        "text": "Any individual found engaging in harassment or misconduct may face immediate removal from Fluke Games, without notice, and may lose access to projects, platforms, and certifications."
      },
      {
        "type": "paragraph",
        "text": "All contributors are expected to interact with one another in a professional, respectful, and ethical manner, both in official work settings and in any communication channels associated with Fluke Games."
      }
    ]
  },
  {
    "id": "ethics",
    "title": "Ethics, integrity, and conflicts of interest",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Fluke Games operates on principles of trust, collaboration, integrity, and ethical conduct."
      },
      {
        "type": "paragraph",
        "text": "Contributors are expected to act in the best interest of the organization and its community."
      },
      {
        "type": "check",
        "id": "ethics-1",
        "text": "Internal knowledge, tools, workflows, assets, and project ideas obtained through Fluke Games must not be used to compete unfairly, harm the organization, or undermine its initiatives.",
        "nested": false
      },
      {
        "type": "check",
        "id": "ethics-2",
        "text": "Project materials, technical solutions, or creative concepts developed at Fluke Games must not be reused or repurposed for competing products, studios, or commercial ventures without explicit written authorization.",
        "nested": false
      },
      {
        "type": "check",
        "id": "ethics-3",
        "text": "Any potential conflict of interest—such as parallel work on competing projects—must be disclosed in advance to the project lead or management.",
        "nested": false
      },
      {
        "type": "paragraph",
        "text": "Ethical conduct and transparency are essential to maintaining trust within the team and ensuring long-term collaboration."
      }
    ]
  },
  {
    "id": "flexibility",
    "title": "Flexible working and professional responsibility",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Fluke Games provides a flexible, remote-friendly work environment designed to support learning, creativity, and collaboration alongside academic or personal commitments."
      },
      {
        "type": "check",
        "id": "flexibility-1",
        "text": "Work schedules are flexible and can be adjusted based on availability, provided responsibilities and deadlines are respected.",
        "nested": false
      },
      {
        "type": "check",
        "id": "flexibility-2",
        "text": "Contributors are expected to clearly communicate their availability, planned absences, and constraints in advance.",
        "nested": false
      },
      {
        "type": "check",
        "id": "flexibility-3",
        "text": "Despite flexibility, professionalism, accountability, and reliability are expected at all times.",
        "nested": false
      },
      {
        "type": "check",
        "id": "flexibility-4",
        "text": "Deliverables, milestones, and agreed timelines must be honored.",
        "nested": false
      },
      {
        "type": "paragraph",
        "text": "Flexibility is offered as a privilege built on trust and mutual respect."
      }
    ]
  },
  {
    "id": "time",
    "title": "Minimum weekly time commitment",
    "blocks": [
      {
        "type": "paragraph",
        "text": "To ensure meaningful participation, skill development, and fair collaboration:"
      },
      {
        "type": "check",
        "id": "time-1",
        "text": "Contributors are expected to dedicate a minimum of 6–8 hours per week to Fluke Games activities.",
        "nested": false
      },
      {
        "type": "check",
        "id": "time-2",
        "text": "This time may include development work, meetings, reviews, documentation, testing, or assigned project tasks.",
        "nested": false
      },
      {
        "type": "check",
        "id": "time-3",
        "text": "Consistent weekly engagement is more important than daily availability.",
        "nested": false
      },
      {
        "type": "paragraph",
        "text": "Failure to meet the minimum time commitment without prior communication or valid justification may impact project continuity, role eligibility, and issuance of completion or experience certificates."
      }
    ]
  },
  {
    "id": "timesheet",
    "title": "Update time sheet weekly",
    "blocks": [
      {
        "type": "paragraph",
        "text": "This keeps delivery and accountability visible across the team every week."
      },
      {
        "type": "check",
        "id": "timesheet-weekly",
        "text": "Update time sheet weekly."
      }
    ]
  },
  {
    "id": "discord",
    "title": "Enable Discord notifications",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Discord is used for notification delivery, workflow coordination, and timely review responsiveness."
      },
      {
        "type": "paragraph",
        "text": "LinkedIn may be used for employee performance metrics and identity alignment. Discord is used for notifications and timely review responsiveness."
      },
      {
        "type": "check",
        "id": "discord-notifications",
        "text": "Enable Discord notifications."
      }
    ]
  }
];
export const CONDUCT_ACKNOWLEDGMENT = "By joining Fluke Games, all interns, volunteers, and contributors acknowledge that they have read, understood, and agreed to comply with the above Code of Conduct & General Policies. These guidelines are established to protect both the organization and its members while maintaining a professional, ethical, and collaborative environment.";
export const CONDUCT_REQUIRED_IDS = [...CONDUCT_SECTIONS.flatMap(section => section.blocks.flatMap(block => block.type === "check" ? [block.id] : [])), "conduct-acknowledgment"];
export function isConductComplete(accepted: Record<string, boolean>) {
  return CONDUCT_REQUIRED_IDS.every(id => accepted[id] === true);
}
export function isConductSectionComplete(section: ConductSection, accepted: Record<string, boolean>) {
  return section.blocks.every(block => block.type !== "check" || accepted[block.id] === true);
}
