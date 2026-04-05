export const dialogCancelButtonSx = {
  textTransform: "none",
  bgcolor: "grey.600",
  color: "common.white",
  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.18)",
  "&:hover": {
    bgcolor: "grey.700",
    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.22)",
  },
  "&:disabled": {
    bgcolor: "action.disabledBackground",
    color: "action.disabled",
  },
};

export const dialogPrimaryButtonSx = {
  textTransform: "none",
  fontWeight: 600,
  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.18)",
  "&:hover": {
    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.22)",
  },
};
