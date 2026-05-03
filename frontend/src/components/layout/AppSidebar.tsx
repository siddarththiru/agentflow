import { Box, Text, VStack } from "@chakra-ui/react";
import {
  FiBell,
  FiClipboard,
  FiGrid,
  FiLayers,
  FiSettings,
  FiTool,
} from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import { navItems } from "../../lib/routes";
import { NavItem } from "../ui/NavItem";

const navIconMap = {
  "/dashboard": FiGrid,
  "/builder": FiTool,
  "/sessions": FiLayers,
  "/approvals": FiClipboard,
  "/notifications": FiBell,
  "/tools": FiSettings,
};

export const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Box
      as="aside"
      w={{ base: "88px", lg: "292px" }}
      flexShrink={0}
      borderRight="1px solid"
      borderColor="border.soft"
      bg="bg.panel"
      px={{ base: 2, lg: 4 }}
      py={5}
      position="sticky"
      top={0}
      h="100vh"
      overflowY="auto"
    >
      <VStack align="stretch" spacing={4}>
        <Box px={{ base: 1, lg: 2 }} pb={3}>
          <Text fontWeight="800" fontSize={{ base: "md", lg: "xl" }} letterSpacing="-0.02em">
            AF
          </Text>
          <Text display={{ base: "none", lg: "block" }} color="text.muted" fontSize="xs" mt={1}>
            AgentFlow Control
          </Text>
        </Box>

        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const ItemIcon = navIconMap[item.path as keyof typeof navIconMap] ?? FiGrid;
          return (
            <Box key={item.path}>
              <NavItem
                label={item.label}
                description={item.description}
                isActive={isActive}
                onClick={() => navigate(item.path)}
                icon={
                  <Box
                    as={ItemIcon as any}
                    boxSize={25}
                    color={isActive ? "brand.900" : "text.muted"}
                    display={{ base: "none", lg: "inline-flex" }}
                  />
                }
              />
            </Box>
          );
        })}
      </VStack>
    </Box>
  );
};
