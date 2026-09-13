const fs = require('fs');
let code = fs.readFileSync('src/components/HomePortal.tsx', 'utf8');

const effectCode = `
  React.useEffect(() => {
    const fetchContests = async () => {
      try {
        const res = await api.getStudentContests();
        setStudentContests(res.contests || []);
      } catch (e) {
        console.error('Failed to load student contests', e);
      } finally {
        setLoadingContests(false);
      }
    };
    if (currentUser) {
      fetchContests();
    } else {
      setLoadingContests(false);
    }
  }, [currentUser]);
`;

code = code.replace("React.useEffect(() => {\n    if (attempt) {", effectCode + "\n  React.useEffect(() => {\n    if (attempt) {");
fs.writeFileSync('src/components/HomePortal.tsx', code);
