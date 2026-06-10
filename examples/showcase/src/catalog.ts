import { ButtonsDemo } from './demos/buttons';
import { FormsDemo } from './demos/forms';
import { FeedbackDemo } from './demos/feedback';
import { NavigationDemo } from './demos/navigation';
import { LayoutDemo } from './demos/layout';
import { DataDemo } from './demos/data';
import { FxDemo } from './demos/fx';
import { TasksDemo } from './demos/tasks';

export interface Demo {
    id: string;
    title: string;
    /** The component factory rendered when this demo is active. */
    component: any;
}

/** Single source of truth for the showcase's demo pages, in display order. */
export const demos: Demo[] = [
    { id: 'buttons', title: 'Buttons', component: ButtonsDemo },
    { id: 'forms', title: 'Forms', component: FormsDemo },
    { id: 'feedback', title: 'Feedback', component: FeedbackDemo },
    { id: 'navigation', title: 'Navigation', component: NavigationDemo },
    { id: 'layout', title: 'Layout', component: LayoutDemo },
    { id: 'data', title: 'Data', component: DataDemo },
    { id: 'fx', title: 'FX', component: FxDemo },
    { id: 'tasks', title: 'Tasks', component: TasksDemo },
];
