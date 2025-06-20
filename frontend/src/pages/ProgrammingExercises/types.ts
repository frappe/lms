interface ProgrammingExercise {
    name: string;
    title: string;
    language: 'Python' | 'JavaScript';
    test_cases_count: number;
    problem_statement: string;
    test_cases: [TestCase];
}

interface TestCase {
    name: string;
    input: string;
    expected_output: string;
    output: string;
    status: 'Passed' | 'Failed';
}

type Filters = {
    exercise?: string,
    member?: string,
    status?: string
}