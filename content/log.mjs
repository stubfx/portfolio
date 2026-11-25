// The git log of a career. Newest first. This file is the home page's spine.
//
// branch: which lane the commit sits on (see `branches`).
// kind:   head | big | slim | merge | fork | root | project
//         `project` commits open a full-screen cover; `project` names the file
//         in content/projects/ (its hash must match).
// title:  inline Markdown; *one word* becomes the Fraunces accent.
// span:   optional display year ("2017–21"); `year` stays machine-readable.

export const branches = [
  { name: 'main', label: 'main' },
  { name: 'mods', label: 'mods', fork: '0000001' },
  { name: 'ibm', label: 'ibm', merge: '2e6a8d1' },
  { name: 'twitch', label: 'twitch' },
  { name: 'accenture', label: 'accenture', fork: '2e6a8d1' },
  { name: 'school', label: 'art-school', fork: '9f3b0c2', merge: '4d01c9a' },
];

export const commits = [
  {
    hash: 'HEAD', year: 2026, branch: 'main', kind: 'head',
    title: 'This *site*.',
    text: 'A git log you can fly through, set in type built for low vision.',
    cells: [['Standard', 'WCAG 2.2, AAA text'], ['Motion', 'follows your setting'], ['Tracking', 'none'], ['Keys', 'Esc, then vim']],
    help: true,
  },
  { hash: 'a3f9c1e', year: 2026, branch: 'main', kind: 'project', project: 'agentic-texture-pipeline', tags: ['planned'] },
  {
    hash: '5c2e91b', year: 2026, branch: 'accenture', kind: 'big', special: true,
    tags: ['palestre', 'ai-way-of-work', 'gaming-corner'],
    title: 'Beyond the *brief*.',
    text: 'Three things Accenture never asked for and got anyway.',
    cells: [
      ['tag: palestre', 'GenAI trainer for classes of about 50, since Nov 2026'],
      ['tag: ai-way-of-work', 'weekly sessions on agentic workflows, since 2024'],
      ['tag: gaming-corner', 'founded the gaming and streaming corner, 2024'],
    ],
  },
  { hash: '4d01c9a', year: 2025, branch: 'main', kind: 'project', project: 'ba-art-direction' },
  { hash: '7be2104', year: 2024, branch: 'accenture', kind: 'project', project: 'configurator-framework' },
  { hash: '9f3b0c2', year: 2022, branch: 'school', kind: 'fork', text: 'fork: art school. Days at work, nights at school.' },
  { hash: '2e6a8d1', year: 2021, branch: 'main', kind: 'merge', text: "merge 'ibm', fork 'accenture'. Same lane, new colour." },
  {
    hash: 'c7d41ab', year: 2019, branch: 'twitch', kind: 'big',
    title: 'Going *live*.',
    text: 'Streaming on Twitch since 2019, including Minecraft games my chat played live through the stream.',
    cells: [['Since', '2019'], ['Stack', 'OBS, Linux'], ['Built', 'chat-driven Minecraft games']],
  },
  {
    hash: 'e8d77f0', year: 2017, span: '2017–21', branch: 'ibm', kind: 'big',
    title: 'Two Android *apps*.',
    text: 'Native apps for a major Italian transport company, from first commit to production.',
    cells: [['Role', 'Android developer'], ['Tools', 'Java, Kotlin, Android SDK'], ['Years', '2017 to 2021']],
  },
  {
    hash: '1a7c3e9', year: 2017, branch: 'ibm', kind: 'big',
    title: 'Hired at *IBM*.',
    text: 'Mods got me in. No joke.',
    cells: [['First project', 'insurance intranet'], ['Tools', 'AngularJS, Bootstrap']],
  },
  { hash: 'b3e0f17', year: 2015, span: '2015–', branch: 'mods', kind: 'project', project: 'servers-and-mods' },
  {
    hash: '0000001', year: 2015, branch: 'main', kind: 'root',
    title: 'initial commit: first Arma 3 *mod*.',
    text: 'High school, side projects, and a sneaky way to make some pocket money. I was young, I needed it, and it compiled.',
    cells: [['Age', 'high school'], ['Motive', 'pocket money'], ['Outcome', 'a career']],
  },
];
