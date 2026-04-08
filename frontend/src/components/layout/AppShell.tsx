import {
  Box,
  Container,
  Flex,
  HStack,
  Spacer,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";

export const AppShell = () => {
  const location = useLocation();

  return (
    <Flex minH="100vh" bg="bg.canvas">
      <AppSidebar />
      <VStack align="stretch" flex={1} spacing={0} minW={0}>
        <HStack
          as="header"
          px={{ base: 4, md: 8 }}
          py={4}
          borderBottom="1px solid"
          borderColor="border.soft"
          bg="rgba(255, 248, 222, 0.88)"
          backdropFilter="blur(4px)"
          position="sticky"
          top={0}
          zIndex={5}
        >
          <VStack align="start" spacing={0}>
            <Text fontWeight="700">AgentFlow</Text>
            <Text fontSize="xs" color="text.muted">
              Operations console
            </Text>
          </VStack>
          <Spacer />
          <Box
            px={3}
            py={1.5}
            borderRadius="full"
            bg="bg.surface"
            border="1px solid"
            borderColor="border.soft"
          >
            <Text color="text.secondary" fontSize="sm">
              {location.pathname}
            </Text>
          </Box>
        </HStack>
        <Container
          maxW="1200px"
          w="100%"
          py={{ base: 5, md: 8 }}
          px={{ base: 4, md: 8 }}
          className="app-page-container"
        >
          <Outlet />
        </Container>
      </VStack>
    </Flex>
  );
};
