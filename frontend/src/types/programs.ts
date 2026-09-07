export interface Program {
    name: string;
    title: string;
    published: boolean;
    enforce_course_order: boolean;
    program_courses: ProgramCourse[];
    // The child table is `program_members` on the doctype; the old name here
    // matched nothing, so every read of it through this type was an error.
    program_members: ProgramMember[];
    // Server-maintained rollups: present on a fetched program, absent on one the
    // form is still building.
    course_count?: number;
    member_count?: number;
}

export interface ProgramCourse {
    course: string;
    course_title: string;
    idx: number;
    name: string;
}

export interface ProgramMember {
    member: string;
    full_name: string;
    progress: number;
    idx: number;
    name: string;
}  

export interface Programs {
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