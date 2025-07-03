export const verifyRoles = (role) => {
  return (req, res, next) => {
    // Check if the request object has a 'role' property
    if (!req?.role) return res.status(401).send("unauthorized no role in token");

    // Check if the role in the request matches the expected role
    if (req.role !== role) {
      console.log(req.role)
      return res.status(401).send("unauthorized");
    }

    // If the role matches, call the next middleware function
    next();
  };
};