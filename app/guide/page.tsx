import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  GraduationCap,
  School2,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { APP_NAME, WORDMARK_LOGO_URL } from "@/lib/branding";

const guideSteps = [
  {
    icon: School2,
    title: "Create the school workspace",
    goal: "Get the school, administrator account, academic year, and first teaching days into the system.",
    actions: [
      "Use Create school account and confirm the email address.",
      "Enter the real school name, location, curriculum, academic year, and timezone.",
      "Select the levels the school offers, such as Form 1, Form 2, Lower Sixth, or Primary.",
    ],
    result: "You now have a private school workspace and the first academic year.",
  },
  {
    icon: Clock3,
    title: "Set the school schedule",
    goal: "Define the grid that every timetable will use.",
    actions: [
      "Open School schedule.",
      "Choose a Monday to Friday or Monday to Saturday teaching week.",
      "Add lesson periods and breaks in the exact order they happen during the day.",
      "Keep breaks as break slots so double lessons never cross them.",
    ],
    result: "The generator knows which days and lesson slots are available.",
  },
  {
    icon: GraduationCap,
    title: "Create levels and class sections",
    goal: "Separate broad academic levels from the actual classes that receive timetables.",
    actions: [
      "Open Levels & classes.",
      "Create levels first, for example Form 1, Form 2, Form 3.",
      "Create class sections under those levels, for example Form 1A, Form 1B, Form 2A.",
      "Use class sections for real timetable groups, not the broad level name.",
    ],
    result: "Every student group that needs a timetable has a class section.",
  },
  {
    icon: BookOpen,
    title: "Add the subject catalog",
    goal: "List all subjects the school teaches before assigning them to levels.",
    actions: [
      "Open Subjects.",
      "Add each subject once, such as Mathematics, English, Physics, Commerce, Computer Science.",
      "Use short subject codes and colors to make the timetable easier to scan.",
      "Do not create separate subjects for each class; the assignment step handles that.",
    ],
    result: "The school has one clean subject catalog.",
  },
  {
    icon: BookOpen,
    title: "Configure subjects per level",
    goal: "Tell ClassGrid which subjects each level teaches and how many periods they need per week.",
    actions: [
      "Return to Levels & classes and choose Manage subjects for a level.",
      "Tick the subjects taught by that level.",
      "Set periods per week for each selected subject.",
      "Create parallel groups only for subjects that can share a slot, such as elective choices where different students split.",
    ],
    result: "The app knows the expected weekly load for every level.",
  },
  {
    icon: UsersRound,
    title: "Add teachers",
    goal: "Create the staff records that the generator must protect from clashes.",
    actions: [
      "Open Teachers.",
      "Add each teacher with name, code, email or phone where available.",
      "Select the subjects the teacher can teach.",
      "Optionally select classes taught to create starter assignments faster.",
    ],
    result: "Teacher workloads and subject links are ready to use.",
  },
  {
    icon: FileCheck2,
    title: "Create teaching assignments",
    goal: "Connect one teacher, one subject, and one class section with the required weekly periods.",
    actions: [
      "Open Teaching assignments.",
      "Choose the teacher, class section, and subject.",
      "Use the periods per week from the level-subject setup.",
      "Choose singles, double, or mixed patterns when the subject needs consecutive lessons.",
    ],
    result: "The generator has its core input: who teaches what, to which class, and how often.",
  },
  {
    icon: CalendarDays,
    title: "Set teacher availability",
    goal: "Block the times when teachers cannot be scheduled.",
    actions: [
      "Open Availability.",
      "Select each teacher and click unavailable slots off.",
      "Leave all possible teaching slots available unless the teacher truly cannot teach then.",
      "Check the workload summary so each teacher has enough available slots for their required periods.",
    ],
    result: "The generator can avoid impossible teacher placements.",
  },
  {
    icon: Sparkles,
    title: "Generate the timetable",
    goal: "Create the first draft using the schedule, classes, subjects, teachers, assignments, availability, and parallel groups.",
    actions: [
      "Open Generate timetable and confirm the timetable checks.",
      "Generate the timetable.",
      "Open Timetables to view the result by class, teacher, or master timetable.",
    ],
    result: "You have a first timetable draft that respects teacher availability, class slots, and hard clash rules.",
  },
  {
    icon: ShieldCheck,
    title: "Run checks, repair, and regenerate",
    goal: "Check whether the draft is complete before anyone treats it as official.",
    actions: [
      "Use Run checks to see missing subjects, missing periods, teacher clashes, or other issues.",
      "Use class repair when one class needs help filling missing lessons.",
      "Lock lessons you want to keep, then regenerate unlocked lessons to improve the rest.",
      "Repeat the checks until the timetable is good enough to share.",
    ],
    result: "You know what still needs attention and can improve the timetable without losing fixed lessons.",
  },
  {
    icon: FileCheck2,
    title: "Publish and export",
    goal: "Make the finished timetable official for the academic year.",
    actions: [
      "Publish only when you are satisfied with the timetable.",
      "Download the PDF for class, teacher, or master copies.",
      "If you later change an input such as availability, periods, subjects, classes, or assignments, regenerate and publish again.",
    ],
    result: "Staff can use the published timetable as the official school version.",
  },
];

const bestPractices = [
  "Enter real class sections before creating assignments; assignments belong to sections such as Form 1A, not just Form 1.",
  "Configure subjects per level before assigning teachers so the correct weekly periods flow into assignments.",
  "Use parallel groups sparingly. They are for genuine split-class subjects that can happen in the same slot.",
  "Mark only true teacher unavailability. Too many blocked slots can make a valid timetable impossible.",
  "Lock only the lessons that must stay fixed. More unlocked lessons give the generator more room to improve the timetable.",
  "Publish only after running checks. If you change timetable inputs later, regenerate and publish the new version.",
];

export default function GuidePage() {
  return (
    <main className="guide-page">
      <nav className="guide-nav">
        <Link className="guide-brand" href="/"><img src={WORDMARK_LOGO_URL} alt={`${APP_NAME} logo`} /></Link>
        <div>
          <Link className="btn ghost" href="/">Home</Link>
          <Link className="btn primary" href="/auth">Create school account <ArrowRight size={16} /></Link>
        </div>
      </nav>

      <section className="guide-hero">
        <span className="kicker">Setup guide</span>
        <h1>Build the best timetable by entering the right data in the right order.</h1>
        <p>Follow this path from a blank workspace to a generated timetable. Each step prepares the data the next screen depends on.</p>
      </section>

      <section className="guide-layout">
        <aside className="guide-rail">
          <b>Recommended order</b>
          {guideSteps.map((step, index) => <a href={`#step-${index + 1}`} key={step.title}>{index + 1}. {step.title}</a>)}
        </aside>

        <div className="guide-content">
          {guideSteps.map((step, index) => (
            <article className="guide-step" id={`step-${index + 1}`} key={step.title}>
              <div className="guide-step-icon"><step.icon /></div>
              <div>
                <span>Step {index + 1}</span>
                <h2>{step.title}</h2>
                <p>{step.goal}</p>
                <ul>{step.actions.map(action => <li key={action}><CheckCircle2 />{action}</li>)}</ul>
                <div className="guide-result"><ShieldCheck /><b>{step.result}</b></div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="guide-practices">
        <div>
          <span className="kicker">Good setup habits</span>
          <h2>Small choices that make generation easier.</h2>
        </div>
        <ul>{bestPractices.map(item => <li key={item}><CheckCircle2 />{item}</li>)}</ul>
      </section>
    </main>
  );
}
