export type LinkAction =
  | {
      type: 'external';
      url: string;
      label: string;
    }
  | {
      type: 'native';
      appId: string;
      label: string;
      args?: string[];
    };

export interface QuickLink {
  id: string;
  name: string;
  description: string;
  category: string;
  accent: string;
  action: LinkAction;
}

export interface EmailProviderLink extends QuickLink {
  loginUrl: string;
}

export const emailProviders: EmailProviderLink[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Google Mail with Drive and Calendar integration.',
    category: 'Email',
    accent: '#ea4335',
    loginUrl: 'https://mail.google.com/',
    action: {
      type: 'external',
      label: 'Open Gmail',
      url: 'https://mail.google.com/',
    },
  },
  {
    id: 'gmx',
    name: 'GMX',
    description: 'German email provider with a classic inbox.',
    category: 'Email',
    accent: '#0056a3',
    loginUrl: 'https://www.gmx.net/',
    action: {
      type: 'external',
      label: 'Open GMX',
      url: 'https://www.gmx.net/',
    },
  },
  {
    id: 'protonmail',
    name: 'Proton Mail',
    description: 'Privacy-focused encrypted email.',
    category: 'Email',
    accent: '#6d4aff',
    loginUrl: 'https://mail.proton.me/',
    action: {
      type: 'external',
      label: 'Open Proton Mail',
      url: 'https://mail.proton.me/',
    },
  },
  {
    id: 'outlook',
    name: 'Outlook',
    description: 'Microsoft email with calendar and tasks.',
    category: 'Email',
    accent: '#0078d4',
    loginUrl: 'https://outlook.live.com/mail/',
    action: {
      type: 'external',
      label: 'Open Outlook',
      url: 'https://outlook.live.com/mail/',
    },
  },
  {
    id: 'yahoo-mail',
    name: 'Yahoo Mail',
    description: 'Large inbox with classic webmail tools.',
    category: 'Email',
    accent: '#5f01d1',
    loginUrl: 'https://mail.yahoo.com/',
    action: {
      type: 'external',
      label: 'Open Yahoo Mail',
      url: 'https://mail.yahoo.com/',
    },
  },
  {
    id: 'fastmail',
    name: 'Fastmail',
    description: 'Fast, clean email for power users.',
    category: 'Email',
    accent: '#ff8c42',
    loginUrl: 'https://app.fastmail.com/',
    action: {
      type: 'external',
      label: 'Open Fastmail',
      url: 'https://app.fastmail.com/',
    },
  },
];

export const quickLinks: QuickLink[] = [
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Drive, files, and shared folders in the browser.',
    category: 'Cloud',
    accent: '#4285f4',
    action: {
      type: 'external',
      label: 'Open Drive',
      url: 'https://drive.google.com/drive/my-drive',
    },
  },
  {
    id: 'google-docs',
    name: 'Google Docs',
    description: 'Documents, notes, and quick drafts in the web app.',
    category: 'Cloud',
    accent: '#34a853',
    action: {
      type: 'external',
      label: 'Open Docs',
      url: 'https://docs.google.com/document/u/0/',
    },
  },
  {
    id: 'notepad',
    name: 'Windows Notepad',
    description: 'Local notes and quick text snippets on your PC.',
    category: 'Local App',
    accent: '#f6c344',
    action: {
      type: 'native',
      label: 'Launch Notepad',
      appId: 'notepad',
    },
  },
  {
    id: 'calculator',
    name: 'Calculator',
    description: 'Useful for fast calculations right from the sidebar.',
    category: 'Local App',
    accent: '#8ab4f8',
    action: {
      type: 'native',
      label: 'Launch Calculator',
      appId: 'calculator',
    },
  },
  {
    id: 'project-home',
    name: 'Project Website',
    description: 'Shadow website, downloads, and project info.',
    category: 'Project',
    accent: '#ff7a59',
    action: {
      type: 'external',
      label: 'Open Website',
      url: 'https://pointer.f1shy312.com',
    },
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Repository, issues, and pull requests in one click.',
    category: 'Project',
    accent: '#c9d1d9',
    action: {
      type: 'external',
      label: 'Open GitHub',
      url: 'https://github.com/',
    },
  },
  {
    id: 'todoist',
    name: 'Todoist',
    description: 'Fast task lists and shared projects.',
    category: 'To-do',
    accent: '#e44332',
    action: {
      type: 'external',
      label: 'Open Todoist',
      url: 'https://todoist.com/',
    },
  },
  {
    id: 'microsoft-to-do',
    name: 'Microsoft To Do',
    description: 'Simple personal and work task lists.',
    category: 'To-do',
    accent: '#2b88d8',
    action: {
      type: 'external',
      label: 'Open To Do',
      url: 'https://to-do.office.com/',
    },
  },
  {
    id: 'ticktick',
    name: 'TickTick',
    description: 'Tasks, calendar, and productivity routines.',
    category: 'To-do',
    accent: '#ffb703',
    action: {
      type: 'external',
      label: 'Open TickTick',
      url: 'https://ticktick.com/',
    },
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Notes, tasks, and lightweight project docs.',
    category: 'To-do',
    accent: '#ffffff',
    action: {
      type: 'external',
      label: 'Open Notion',
      url: 'https://www.notion.so/',
    },
  },
  {
    id: 'trello',
    name: 'Trello',
    description: 'Kanban boards for simple task tracking.',
    category: 'To-do',
    accent: '#0079bf',
    action: {
      type: 'external',
      label: 'Open Trello',
      url: 'https://trello.com/',
    },
  },
  {
    id: 'asana',
    name: 'Asana',
    description: 'Team projects and task planning.',
    category: 'To-do',
    accent: '#ff7f50',
    action: {
      type: 'external',
      label: 'Open Asana',
      url: 'https://asana.com/',
    },
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    description: 'All-in-one productivity workspace.',
    category: 'To-do',
    accent: '#7b68ee',
    action: {
      type: 'external',
      label: 'Open ClickUp',
      url: 'https://clickup.com/',
    },
  },
  {
    id: 'google-tasks',
    name: 'Google Tasks',
    description: 'Simple task lists in the Google ecosystem.',
    category: 'To-do',
    accent: '#4285f4',
    action: {
      type: 'external',
      label: 'Open Tasks',
      url: 'https://tasks.google.com/',
    },
  },
];

export const linkCategories = ['Email', 'Cloud', 'To-do', 'Local App', 'Project'] as const;
