interface Program {
    name: string;
    title: string;
    published: boolean;
    enforce_course_order: boolean;
    program_courses: ProgramCourse[];
    program_batches: ProgramMember[];
    course_count: number;
    member_count: number;
}

interface ProgramCourse {
    course: string;
    course_title: string;
    idx: number;
    name: string;
}

interface ProgramMember {
    member: string;
    full_name: string;
    progress: number;
    idx: number;
    name: string;
}  

interface Programs {
    data: Program[];
    reload: () => void;
    hasNextPage: boolean;
    next: () => void;
    setValue: {
        submit: (
            data: Program,
            options?: { onSuccess?: () => void }
        ) => void;
    };
    insert: {
        submit: (
            data: Program,
            options?: { onSuccess?: () => void }
        ) => void;
    };
    delete: {
        submit: (
            name: string,
            options?: { onSuccess?: () => void }
        ) => void;
    };
}